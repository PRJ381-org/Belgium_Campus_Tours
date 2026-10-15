// Fill out your copyright notice in the Description page of Project Settings.

using UnrealBuildTool;
using System.IO;

public class PRJ381 : ModuleRules
{
	public PRJ381(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
	
		PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine", "InputCore", "Json", "JsonUtilities", "HTTP" });

		PrivateDependencyModuleNames.Add("PakFile");
		bool SupportsGooglePAD = Target.Platform == UnrealTargetPlatform.Android
			|| Target.Platform == UnrealTargetPlatform.Win64
			|| Target.Platform == UnrealTargetPlatform.Mac
			|| Target.Platform == UnrealTargetPlatform.Linux;
		PrivateDefinitions.Add("PRJ381_WITH_GOOGLEPAD=" + (SupportsGooglePAD ? "1" : "0"));
		if (SupportsGooglePAD)
		{
			PrivateDependencyModuleNames.Add("GooglePAD");
		}
		if (Target.Platform == UnrealTargetPlatform.Android)
		{
			// GooglePAD's public header includes this SDK, but its module keeps the path private.
			PrivateIncludePaths.Add(Path.Combine(EngineDirectory,
				"Plugins/Runtime/GooglePAD/Source/ThirdParty/play-core-native-sdk/include"));
		}

		// Uncomment if you are using Slate UI
		// PrivateDependencyModuleNames.AddRange(new string[] { "Slate", "SlateCore" });
		
		// Uncomment if you are using online features
		// PrivateDependencyModuleNames.Add("OnlineSubsystem");

		// To include OnlineSubsystemSteam, add it to the plugins section in your uproject file with the Enabled attribute set to true
	}
}
