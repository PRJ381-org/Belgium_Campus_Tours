#pragma once

#include "CoreMinimal.h"
#include "Engine/LatentActionManager.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "CampusAssetDeliveryLibrary.generated.h"

/** Runtime delivery for the explicit campus chunk assignments in /Game/Chunking. */
UCLASS()
class PRJ381_API UCampusAssetDeliveryLibrary : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:
	/** True only on Android builds with GooglePAD enabled; false for desktop and the Quest pipeline. */
	UFUNCTION(BlueprintPure, Category = "Campus|Asset Delivery")
	static bool IsCampusPADRequired();

	/** SharedCampus first, then the destination; an unknown campus returns an empty array. */
	UFUNCTION(BlueprintPure, Category = "Campus|Asset Delivery")
	static TArray<FString> GetCampusAssetPacks(FName TargetLevel);

	/** Never unloads a level. The caller must branch on Success before streaming content. */
	UFUNCTION(BlueprintCallable, Category = "Campus|Asset Delivery", meta = (WorldContext = "WorldContextObject", Latent, LatentInfo = "LatentInfo", DisplayName = "Ensure Campus Content Ready"))
	static void EnsureCampusContentReady(UObject* WorldContextObject, FName TargetLevel,
		FLatentActionInfo LatentInfo, bool& bSuccess, FString& ErrorMessage);

	/** Progress only for the currently active request in this game world. */
	UFUNCTION(BlueprintPure, Category = "Campus|Asset Delivery", meta = (WorldContext = "WorldContextObject"))
	static void GetCampusDownloadProgress(UObject* WorldContextObject, bool& bActive,
		float& Progress, FString& StatusMessage);
};
