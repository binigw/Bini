import { PushNotificationSettings } from "@/components/notifications/push-notification-settings";

export function Settings() {
  return (
    <div className="flex flex-col gap-6 h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">
          System configuration and preferences.
        </p>
      </div>

      <div className="max-w-2xl">
        <PushNotificationSettings />
      </div>

      <div className="flex-1 flex items-center justify-center border border-dashed border-border rounded-lg bg-card/50">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-semibold mb-2">More settings coming soon</h2>
          <p className="text-muted-foreground">
            Configuration options for threshold limits and system integrations will be available in the next release.
          </p>
        </div>
      </div>
    </div>
  );
}
