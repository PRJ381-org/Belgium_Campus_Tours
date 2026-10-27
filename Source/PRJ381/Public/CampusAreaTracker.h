// CampusAreaTracker.h
// GameInstance subsystem that fires area_enter / area_exit as the player moves
// between campus areas, with time-spent on exit. Works two ways:
//   - automatically from the map name, when areas are separate maps
//   - manually via SetArea(), when areas are streamed sublevels of one
//     persistent map (which is how this project is built)

#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "CampusAreaTracker.generated.h"

class UWorld;

UCLASS()
class UCampusAreaTracker : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;
	virtual void Deinitialize() override;

	/** Call when a streamed sublevel becomes the player's current area.
	 *  Accepts "LVL_TechnoLab" or "TechnoLab" — the prefix is stripped.
	 *  Once called, automatic map-name tracking stops for the session. */
	UFUNCTION(BlueprintCallable, Category = "Analytics")
	void SetArea(const FString& NewArea);

private:
	UFUNCTION()
	void HandleSessionReady(const FString& InSessionId);

	void OnPostLoadMap(UWorld* LoadedWorld);
	void UpdateAreaFromWorld(UWorld* World);
	void ApplyArea(const FString& NewArea);
	void SendAreaEvent(const FString& EventType, const FString& Area, int32 DurationMs);
	static FString DeriveArea(UWorld* World);

	FString CurrentArea;
	double  EnterTimeSeconds = 0.0;
	bool    bEnterSent = false;
	bool    bManualArea = false;

	FDelegateHandle PostLoadMapHandle;
};