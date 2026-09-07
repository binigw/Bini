import { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing, Loader2 } from 'lucide-react';
import {
  useListPersonnel,
  useRegisterFcmToken,
  useUnregisterFcmToken,
  useGetNotificationsStatus,
  useSendTestAlert,
  getListPersonnelQueryKey,
  getGetNotificationsStatusQueryKey,
} from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ApiErrorState } from '@/components/api-error-state';
import {
  isFirebaseConfigured,
  requestPushToken,
  listenForForegroundMessages,
  getUnsupportedReason,
} from '@/lib/firebase';

function unsupportedMessage(): string {
  const reason = getUnsupportedReason();
  switch (reason) {
    case 'ios-not-installed':
      return 'On iPhone/iPad, Safari only supports push alerts once this app is added to your Home Screen. Tap the Share icon, choose "Add to Home Screen", then open it from there and try again.';
    case 'no-notification-api':
      return 'This browser does not support web push notifications. Try the latest Chrome, Edge, or Firefox instead.';
    case 'no-service-worker':
      return 'This browser does not support the background service needed for push alerts. Try the latest Chrome, Edge, or Firefox instead.';
    default:
      return 'This browser or Firebase configuration does not support push alerts.';
  }
}

const SELECTED_PERSONNEL_KEY = 'voltguard.selectedPersonnelId';
const PUSH_ENABLED_KEY = 'voltguard.pushEnabled';

export function PushNotificationSettings() {
  const { toast } = useToast();
  const { data: personnel, isLoading: personnelLoading, isError: isPersonnelError } = useListPersonnel({
    query: { refetchInterval: 30000, queryKey: getListPersonnelQueryKey() },
  });
  const { data: status, isError: isStatusError } = useGetNotificationsStatus({
    query: { refetchInterval: 30000, queryKey: getGetNotificationsStatusQueryKey() },
  });
  const registerToken = useRegisterFcmToken();
  const unregisterToken = useUnregisterFcmToken();
  const testAlert = useSendTestAlert();

  const [selectedPersonnelId, setSelectedPersonnelId] = useState<string>('');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [permissionState, setPermissionState] = useState<NotificationPermission | 'unsupported'>(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported',
  );

  const firebaseReady = isFirebaseConfigured();
  const platformUnsupported =
    typeof window !== 'undefined' &&
    (!('Notification' in window) || !('serviceWorker' in navigator) || getUnsupportedReason() === 'ios-not-installed');

  useEffect(() => {
    const storedId = localStorage.getItem(SELECTED_PERSONNEL_KEY);
    if (storedId) setSelectedPersonnelId(storedId);
    setPushEnabled(localStorage.getItem(PUSH_ENABLED_KEY) === 'true');
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    listenForForegroundMessages(({ title, body }) => {
      toast({ title: title ?? 'VoltGuard AI Alert', description: body });
    }).then((unsub) => {
      unsubscribe = unsub;
    }).catch(() => {
      // Push setup is optional; browser capability failures must not break Settings.
    });
    return () => unsubscribe?.();
  }, [toast]);

  const personnelRecords = Array.isArray(personnel)
    ? personnel.filter((person) => Boolean(person) && typeof person === 'object')
    : [];
  const selectedPerson = personnelRecords.find((p) => String(p.id) === selectedPersonnelId);
  const statusView = status && typeof status === 'object' ? status : undefined;
  const firebaseStatus = statusView?.firebase;
  const telegramStatus = statusView?.telegram;

  async function handleToggle(checked: boolean) {
    if (!selectedPersonnelId) {
      toast({
        title: 'Select your name first',
        description: 'Choose your technician profile before enabling push alerts.',
        variant: 'destructive',
      });
      return;
    }

    setIsBusy(true);
    try {
      if (checked) {
        const result = await requestPushToken();
        setPermissionState(
          typeof window !== 'undefined' && 'Notification' in window
            ? Notification.permission
            : 'unsupported',
        );

        if (result.status === 'unsupported') {
          toast({
            title: 'Push notifications unavailable',
            description: unsupportedMessage(),
            variant: 'destructive',
          });
          return;
        }
        if (result.status === 'denied') {
          toast({
            title: 'Permission denied',
            description: 'Enable notifications for this site in your browser settings.',
            variant: 'destructive',
          });
          return;
        }
        if (result.status === 'error') {
          toast({
            title: 'Could not enable push notifications',
            description: result.message,
            variant: 'destructive',
          });
          return;
        }

        await registerToken.mutateAsync({
          data: { personnelId: Number(selectedPersonnelId), token: result.token },
        });
        setPushEnabled(true);
        localStorage.setItem(PUSH_ENABLED_KEY, 'true');
        toast({
          title: 'Push notifications enabled',
          description: `You'll receive live alerts as ${selectedPerson?.name ?? 'this technician'}.`,
        });
      } else {
        await unregisterToken.mutateAsync({ personnelId: Number(selectedPersonnelId) });
        setPushEnabled(false);
        localStorage.setItem(PUSH_ENABLED_KEY, 'false');
        toast({ title: 'Push notifications disabled' });
      }
    } finally {
      setIsBusy(false);
    }
  }

  function handlePersonnelChange(value: string) {
    setSelectedPersonnelId(value);
    localStorage.setItem(SELECTED_PERSONNEL_KEY, value);
  }

  async function handleTestAlert() {
    if (!selectedPersonnelId) {
      toast({
        title: 'Select your name first',
        description: 'Choose a technician profile before sending a test alert.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const result = await testAlert.mutateAsync({
        data: { personnelId: Number(selectedPersonnelId) },
      });
      const delivered =
        result.fcm.successCount + result.telegram.successCount;
      toast({
        title: delivered > 0 ? 'Test alert sent' : 'Test alert processed',
        description:
          delivered > 0
            ? `Delivered through ${delivered} configured notification channel${delivered === 1 ? '' : 's'}.`
            : 'No configured Firebase or Telegram recipient accepted the test alert.',
        variant: delivered > 0 ? 'default' : 'destructive',
      });
    } catch (error) {
      toast({
        title: 'Test alert failed',
        description:
          error instanceof Error
            ? error.message
            : 'The backend could not send the test alert.',
        variant: 'destructive',
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BellRing className="h-5 w-5 text-primary" />
          <CardTitle>Push Notifications</CardTitle>
        </div>
        <CardDescription>
          Get real-time browser alerts the moment a critical motor fault is detected.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isPersonnelError && <ApiErrorState message="Unable to load technician profiles." />}
        {isStatusError && <ApiErrorState message="Unable to load notification status." />}
        {!firebaseReady && (
          <div className="rounded-md border border-dashed border-border bg-muted/50 p-4 text-sm text-muted-foreground">
            Push notifications are not fully configured on this server yet.
          </div>
        )}

        {firebaseReady && platformUnsupported && (
          <div className="rounded-md border border-dashed border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
            {unsupportedMessage()}
          </div>
        )}

        <div className="space-y-2">
          <Label>Your technician profile</Label>
          <Select
            value={selectedPersonnelId}
            onValueChange={handlePersonnelChange}
            disabled={personnelLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select your name" />
            </SelectTrigger>
            <SelectContent>
              {personnelRecords.map((person) => (
                <SelectItem key={person.id} value={String(person.id)}>
                  {person.name} — {person.role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Notifications will be tied to this technician record so the right alerts reach you.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div className="flex items-start gap-3">
            {pushEnabled ? (
              <Bell className="h-5 w-5 text-emerald-500 mt-0.5" />
            ) : (
              <BellOff className="h-5 w-5 text-muted-foreground mt-0.5" />
            )}
            <div>
              <p className="text-sm font-medium">Enable browser push alerts</p>
              <p className="text-xs text-muted-foreground">
                {permissionState === 'denied'
                  ? 'Blocked by browser — update site permissions to enable.'
                  : 'Requires notification permission for this site.'}
              </p>
            </div>
          </div>
          {isBusy ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <Switch
              checked={pushEnabled}
              onCheckedChange={handleToggle}
              disabled={!firebaseReady || permissionState === 'denied' || platformUnsupported}
            />
          )}
        </div>

        {firebaseStatus && telegramStatus && (
          <div className="space-y-3 pt-1">
            <div className="flex flex-wrap gap-2">
              <Badge variant={firebaseStatus.configured ? 'default' : 'secondary'}>
                Firebase: {firebaseStatus.configured ? 'Connected' : 'Not configured'}
              </Badge>
              <Badge variant="secondary">
                {typeof firebaseStatus.registeredTokens === 'number' ? firebaseStatus.registeredTokens : 0} device{firebaseStatus.registeredTokens === 1 ? '' : 's'} registered
              </Badge>
              <Badge variant={telegramStatus.configured ? 'default' : 'secondary'}>
                Telegram: {telegramStatus.configured ? 'Connected' : 'Not configured'}
              </Badge>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={handleTestAlert}
              disabled={!selectedPersonnelId || testAlert.isPending}
            >
              {testAlert.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <BellRing className="mr-2 h-4 w-4" />
              )}
              Send Test Alert
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
