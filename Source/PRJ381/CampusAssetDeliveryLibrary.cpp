#include "CampusAssetDeliveryLibrary.h"

#include "Engine/Engine.h"
#include "Engine/World.h"
#include "HAL/FileManager.h"
#include "HAL/PlatformTime.h"
#include "LatentActions.h"
#include "Misc/ConfigCacheIni.h"
#include "Misc/CoreDelegates.h"
#include "Misc/PackageName.h"
#include "Misc/Paths.h"
#include "MountPaksExArgs.h"

#if PRJ381_WITH_GOOGLEPAD
#include "GooglePADFunctionLibrary.h"
#endif

DEFINE_LOG_CATEGORY_STATIC(LogCampusPAD, Log, All);

namespace
{
class FCampusPADAction;
TMap<TWeakObjectPtr<UWorld>, FCampusPADAction*> ActiveCampusRequests;

struct FCampusPackState
{
	FString Name;
	bool bMounted = false;
	int64 TotalBytes = 0;
	int64 DownloadedBytes = 0;
};

class FCampusPADAction final : public FPendingLatentAction
{
public:
	FCampusPADAction(UWorld* World, const TArray<FString>& PackNames,
		const FLatentActionInfo& LatentInfo, bool& Success, FString& Error)
		: WorldKey(World), ExecutionFunction(LatentInfo.ExecutionFunction),
		  OutputLink(LatentInfo.Linkage), CallbackTarget(LatentInfo.CallbackTarget),
		  OutSuccess(Success), OutError(Error), StartedAt(FPlatformTime::Seconds())
	{
		OutSuccess = false;
		OutError.Reset();
		if (!UCampusAssetDeliveryLibrary::IsCampusPADRequired())
		{
			OutSuccess = true;
			bFinished = true;
			return;
		}
		if (PackNames.IsEmpty())
		{
			Fail(TEXT("Unknown campus: no asset-pack mapping exists."));
			return;
		}
		if (ActiveCampusRequests.Contains(WorldKey))
		{
			Fail(TEXT("Another campus download is already in progress."));
			return;
		}
		for (const FString& Name : PackNames)
		{
			FCampusPackState& Pack = Packs.AddDefaulted_GetRef();
			Pack.Name = Name;
		}
		ActiveCampusRequests.Add(WorldKey, this);
	}

	virtual ~FCampusPADAction() override
	{
		FCampusPADAction** Current = ActiveCampusRequests.Find(WorldKey);
		if (Current && *Current == this)
		{
			ActiveCampusRequests.Remove(WorldKey);
		}
#if PRJ381_WITH_GOOGLEPAD
		if (!bFinished && !RequestedPacks.IsEmpty())
		{
			UGooglePADFunctionLibrary::CancelDownload(RequestedPacks);
		}
#endif
	}

	virtual void UpdateOperation(FLatentResponse& Response) override
	{
		const double Now = FPlatformTime::Seconds();
		if (!bFinished && Now >= NextPollAt)
		{
			NextPollAt = Now + 0.25;
			if (Now - StartedAt > 1800.0)
			{
				Fail(TEXT("Campus download timed out. Check your connection and retry."));
			}
#if PRJ381_WITH_GOOGLEPAD
			else if (!bRequested)
			{
				StartRequest();
			}
			else
			{
				PollRequest();
			}
#else
			else
			{
				Fail(TEXT("GooglePAD is not supported on this platform."));
			}
#endif
		}
		Response.FinishAndTriggerIf(bFinished, ExecutionFunction, OutputLink, CallbackTarget);
	}

	float GetProgress() const
	{
		int64 Downloaded = 0;
		int64 Total = 0;
		for (const FCampusPackState& Pack : Packs)
		{
			Downloaded += Pack.bMounted ? Pack.TotalBytes : Pack.DownloadedBytes;
			Total += Pack.TotalBytes;
		}
		return Total > 0 ? FMath::Clamp(static_cast<float>(static_cast<double>(Downloaded) / Total), 0.0f, 1.0f) : 0.0f;
	}

	const FString& GetStatus() const { return Status; }
	bool IsActive() const { return !bFinished; }

private:
	void Fail(const FString& Message)
	{
		OutSuccess = false;
		OutError = Message;
		Status = Message;
		bFinished = true;
#if PRJ381_WITH_GOOGLEPAD
		if (!RequestedPacks.IsEmpty())
		{
			UGooglePADFunctionLibrary::CancelDownload(RequestedPacks);
		}
#endif
		UE_LOG(LogCampusPAD, Error, TEXT("%s"), *Message);
	}

	void Complete()
	{
		OutSuccess = true;
		OutError.Reset();
		Status = TEXT("Campus content ready");
		bFinished = true;
		UE_LOG(LogCampusPAD, Display, TEXT("Required campus packs are installed and mounted."));
	}

#if PRJ381_WITH_GOOGLEPAD
	bool TryMountInstalledPack(FCampusPackState& Pack)
	{
		int32 Location = 0;
		const EGooglePADErrorCode Code = UGooglePADFunctionLibrary::GetAssetPackLocation(Pack.Name, Location);
		if (Code != EGooglePADErrorCode::AssetPack_NO_ERROR || Location == 0)
		{
			return false;
		}
		const EGooglePADStorageMethod Storage = UGooglePADFunctionLibrary::GetStorageMethod(Location);
		FString AssetsPath = UGooglePADFunctionLibrary::GetAssetsPath(Location);
		UGooglePADFunctionLibrary::ReleaseAssetPackLocation(Location);
		if (Storage != EGooglePADStorageMethod::AssetPack_STORAGE_FILES || AssetsPath.IsEmpty())
		{
			
			return false;
		}
		if (!FCoreDelegates::MountPaksEx.IsBound())
		{
			Fail(TEXT("The runtime content mount service is unavailable."));
			return false;
		}
		FPaths::NormalizeDirectoryName(AssetsPath);
		TArray<FString> PakFiles;
		IFileManager::Get().FindFilesRecursive(PakFiles, *AssetsPath, TEXT("*.pak"), true, false);
		PakFiles.Sort();
		if (PakFiles.IsEmpty())
		{
			Fail(FString::Printf(TEXT("Asset pack %s contains no .pak files."), *Pack.Name));
			return false;
		}
		// Each regular AND optional .pak mounts its matching .utoc and package store through UE 5.8.
		for (const FString& PakPath : PakFiles)
		{
			if (!IFileManager::Get().FileExists(*FPaths::ChangeExtension(PakPath, TEXT("utoc"))) ||
				!IFileManager::Get().FileExists(*FPaths::ChangeExtension(PakPath, TEXT("ucas"))))
			{
				Fail(FString::Printf(TEXT("Asset pack %s is missing IOStore companion files."), *Pack.Name));
				return false;
			}
			UE::FMountPaksExArgs Args;
			Args.PakFilePath = *PakPath;
			Args.Order = 0;
			FCoreDelegates::MountPaksEx.Execute(MakeArrayView(&Args, 1));
			if (Args.Result.HasError() || Args.Result.GetValue().PakFile == nullptr)
			{
				Fail(FString::Printf(TEXT("Could not mount %s. Check LogPakFile for details."), *FPaths::GetCleanFilename(PakPath)));
				return false;
			}
		}
		Pack.bMounted = true;
		Pack.DownloadedBytes = Pack.TotalBytes;
		UE_LOG(LogCampusPAD, Display, TEXT("Mounted asset pack %s (%d containers)."), *Pack.Name, PakFiles.Num());
		return true;
	}

	void StartRequest()
	{
		RequestedPacks.Reset();
		for (FCampusPackState& Pack : Packs)
		{
			if (!Pack.bMounted && !TryMountInstalledPack(Pack))
			{
				if (bFinished) { return; }
				RequestedPacks.Add(Pack.Name);
			}
		}
		if (RequestedPacks.IsEmpty())
		{
			Complete();
			return;
		}
		const EGooglePADErrorCode Code = UGooglePADFunctionLibrary::RequestDownload(RequestedPacks);
		if (Code == EGooglePADErrorCode::AssetPack_INITIALIZATION_NEEDED && FPlatformTime::Seconds() - StartedAt < 10.0)
		{
			Status = TEXT("Initializing Google Play asset delivery");
			return;
		}
		if (Code != EGooglePADErrorCode::AssetPack_NO_ERROR)
		{
			Fail(FString::Printf(TEXT("Google Play download could not start (code %d). Check your connection and Play/local-testing installation."), static_cast<int32>(Code)));
			return;
		}
		bRequested = true;
		RequestedAt = FPlatformTime::Seconds();
		Status = TEXT("Downloading campus content");
	}

	void PollRequest()
	{
		Status = TEXT("Downloading campus content");
		if (bConfirmationRequested)
		{
			EGooglePADConfirmationDialogStatus Confirmation = EGooglePADConfirmationDialogStatus::AssetPack_CONFIRMATION_DIALOG_UNKNOWN;
			const EGooglePADErrorCode Code = UGooglePADFunctionLibrary::GetShowConfirmationDialogStatus(Confirmation);
			if (Code != EGooglePADErrorCode::AssetPack_NO_ERROR || Confirmation == EGooglePADConfirmationDialogStatus::AssetPack_CONFIRMATION_DIALOG_CANCELED)
			{
				Fail(TEXT("The download confirmation was canceled or unavailable. Retry to continue."));
				return;
			}
		}
		bool bAllReady = true;
		for (FCampusPackState& Pack : Packs)
		{
			if (Pack.bMounted) { continue; }
			int32 State = 0;
			const EGooglePADErrorCode Code = UGooglePADFunctionLibrary::GetDownloadState(Pack.Name, State);
			if (Code != EGooglePADErrorCode::AssetPack_NO_ERROR || State == 0)
			{
				if (FPlatformTime::Seconds() - RequestedAt < 10.0)
				{
					bAllReady = false;
					continue;
				}
				Fail(FString::Printf(TEXT("Unable to read %s download status (code %d)."), *Pack.Name, static_cast<int32>(Code)));
				return;
			}
			const EGooglePADDownloadStatus DownloadStatus = UGooglePADFunctionLibrary::GetDownloadStatus(State);
			Pack.TotalBytes = FMath::Max<int64>(0, UGooglePADFunctionLibrary::GetTotalBytesToDownload(State));
			Pack.DownloadedBytes = FMath::Max<int64>(0, UGooglePADFunctionLibrary::GetBytesDownloaded(State));
			UGooglePADFunctionLibrary::ReleaseDownloadState(State);
			if (DownloadStatus == EGooglePADDownloadStatus::AssetPack_DOWNLOAD_COMPLETED)
			{
				Status = TEXT("Mounting campus content");
				if (!TryMountInstalledPack(Pack))
				{
					if (bFinished) { return; }
					bAllReady = false;
				}
			}
			else if (DownloadStatus == EGooglePADDownloadStatus::AssetPack_DOWNLOAD_FAILED ||
				DownloadStatus == EGooglePADDownloadStatus::AssetPack_DOWNLOAD_CANCELED ||
				DownloadStatus == EGooglePADDownloadStatus::AssetPack_INFO_FAILED)
			{
				Fail(FString::Printf(TEXT("Download of %s failed or was canceled. Check your connection/storage and retry."), *Pack.Name));
				return;
			}
			else
			{
				bAllReady = false;
				if (DownloadStatus == EGooglePADDownloadStatus::AssetPack_WAITING_FOR_WIFI ||
					DownloadStatus == EGooglePADDownloadStatus::AssetPack_REQUIRES_USER_CONFIRMATION)
				{
					Status = TEXT("Waiting for Google Play download approval");
					if (!bConfirmationRequested)
					{
						const EGooglePADErrorCode DialogCode = UGooglePADFunctionLibrary::ShowConfirmationDialog();
						if (DialogCode == EGooglePADErrorCode::AssetPack_NO_ERROR)
						{
							bConfirmationRequested = true;
						}
						else if (DialogCode != EGooglePADErrorCode::AssetPack_CONFIRMATION_NOT_REQUIRED)
						{
							Fail(TEXT("Google Play could not display the download approval dialog."));
							return;
						}
					}
				}
			}
		}
		if (bAllReady) { Complete(); }
	}
#endif

	TWeakObjectPtr<UWorld> WorldKey;
	FName ExecutionFunction;
	int32 OutputLink;
	FWeakObjectPtr CallbackTarget;
	bool& OutSuccess;
	FString& OutError;
	TArray<FCampusPackState> Packs;
	TArray<FString> RequestedPacks;
	FString Status = TEXT("Preparing campus content");
	double StartedAt = 0.0;
	double RequestedAt = 0.0;
	double NextPollAt = 0.0;
	bool bFinished = false;
	bool bRequested = false;
	bool bConfirmationRequested = false;
};
}

bool UCampusAssetDeliveryLibrary::IsCampusPADRequired()
{
#if PLATFORM_ANDROID && !WITH_EDITOR && PRJ381_WITH_GOOGLEPAD
	bool bEnabled = false;
	// Match GooglePAD's own initialization switch; the Quest pipeline explicitly disables it.
	if (GConfig)
	{
		GConfig->GetBool(TEXT("/Script/GooglePADEditor.GooglePADRuntimeSettings"), TEXT("bEnablePlugin"), bEnabled, GEngineIni);
	}
	return bEnabled;
#else
	return false;
#endif
}

TArray<FString> UCampusAssetDeliveryLibrary::GetCampusAssetPacks(FName TargetLevel)
{
	static const TMap<FName, int32> Chunks = {
		{TEXT("LVL_Alpha"), 1}, {TEXT("LVL_Auditorium"), 2},
		{TEXT("LVL_Cafeteria"), 3}, {TEXT("LVL_Hallway"), 4},
		{TEXT("LVL_Library"), 5}, {TEXT("LVL_OuterCampus"), 6},
		{TEXT("LVL_Sigma"), 7}, {TEXT("LVL_TechnoLab"), 8}
	};
	FString ShortName = FPackageName::GetShortName(TargetLevel.ToString());
	int32 DotIndex = INDEX_NONE;
	if (ShortName.FindChar(TEXT('.'), DotIndex)) { ShortName.LeftInline(DotIndex); }
	if (const int32* Chunk = Chunks.Find(FName(*ShortName)))
	{
		return {TEXT("prj381_chunk9"), FString::Printf(TEXT("prj381_chunk%d"), *Chunk)};
	}
	return {};
}

void UCampusAssetDeliveryLibrary::EnsureCampusContentReady(UObject* WorldContextObject, FName TargetLevel,
	FLatentActionInfo LatentInfo, bool& bSuccess, FString& ErrorMessage)
{
	UWorld* World = GEngine ? GEngine->GetWorldFromContextObject(WorldContextObject, EGetWorldErrorMode::LogAndReturnNull) : nullptr;
	if (!World)
	{
		bSuccess = false;
		ErrorMessage = TEXT("No game world is available for asset delivery.");
		return;
	}
	FLatentActionManager& Manager = World->GetLatentActionManager();
	if (!Manager.FindExistingAction<FCampusPADAction>(LatentInfo.CallbackTarget, LatentInfo.UUID))
	{
		Manager.AddNewAction(LatentInfo.CallbackTarget, LatentInfo.UUID,
			new FCampusPADAction(World, GetCampusAssetPacks(TargetLevel), LatentInfo, bSuccess, ErrorMessage));
	}
}

void UCampusAssetDeliveryLibrary::GetCampusDownloadProgress(UObject* WorldContextObject, bool& bActive,
	float& Progress, FString& StatusMessage)
{
	bActive = false;
	Progress = 0.0f;
	StatusMessage.Reset();
	UWorld* World = GEngine ? GEngine->GetWorldFromContextObject(WorldContextObject, EGetWorldErrorMode::ReturnNull) : nullptr;
	if (World)
	{
		FCampusPADAction** Request = ActiveCampusRequests.Find(TWeakObjectPtr<UWorld>(World));
		if (Request && *Request && (*Request)->IsActive())
		{
			bActive = true;
			Progress = (*Request)->GetProgress();
			StatusMessage = (*Request)->GetStatus();
		}
	}
}
