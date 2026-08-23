import "server-only";

export type SafeNotificationDiagnosticCode =
  "provider_disabled" | "external_delivery_unavailable";

export type NotificationLocalizationKey =
  "providerDisabled" | "externalDeliveryUnavailable";

export type SafeNotificationDiagnostic = Readonly<{
  code: SafeNotificationDiagnosticCode;
  localizationKey: NotificationLocalizationKey;
}>;

export const NOTIFICATION_DIAGNOSTIC_KEY_MAP = {
  provider_disabled: "providerDisabled",
  external_delivery_unavailable: "externalDeliveryUnavailable",
} as const satisfies Record<
  SafeNotificationDiagnosticCode,
  NotificationLocalizationKey
>;

export function mapNotificationDiagnosticKey(
  code: SafeNotificationDiagnosticCode,
): NotificationLocalizationKey {
  return NOTIFICATION_DIAGNOSTIC_KEY_MAP[code];
}

export function getSafeNotificationDiagnostic(
  code: SafeNotificationDiagnosticCode,
): SafeNotificationDiagnostic {
  return {
    code,
    localizationKey: mapNotificationDiagnosticKey(code),
  };
}
