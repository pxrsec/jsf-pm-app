import "server-only";

export type ExternalNotificationChannel = "email" | "whatsapp";

export type ExternalDeliveryMode = "disabled" | "active";

export type ExternalDeliveryConfigurationCode =
  | "mode_disabled"
  | "mode_missing"
  | "mode_blank"
  | "mode_placeholder"
  | "mode_invalid"
  | "provider_configuration_incomplete"
  | "provider_configuration_malformed"
  | "provider_configuration_placeholder";

export type ProviderConfigurationCode =
  | "provider_disabled"
  | "provider_missing"
  | "provider_blank"
  | "provider_placeholder"
  | "provider_partial"
  | "provider_malformed";

export type ProviderConfigurationState =
  { kind: "disabled"; code: ProviderConfigurationCode } | { kind: "ready" };

export type ExternalDeliveryCapability =
  | {
      kind: "disabled";
      mode: "disabled";
      code: ExternalDeliveryConfigurationCode;
      email: { kind: "disabled"; code: ProviderConfigurationCode };
      whatsapp: { kind: "disabled"; code: ProviderConfigurationCode };
    }
  | {
      kind: "invalid";
      mode: "disabled";
      code: ExternalDeliveryConfigurationCode;
      email: ProviderConfigurationState;
      whatsapp: ProviderConfigurationState;
    }
  | {
      kind: "active-ready";
      mode: "active";
      email: { kind: "ready" };
      whatsapp: { kind: "ready" };
    };

export type DisabledAdapterRequest = Readonly<{
  channel: ExternalNotificationChannel;
  eventCategory: string;
}>;

export type DisabledAdapterResult = Readonly<{
  kind: "not_dispatched";
  channel: ExternalNotificationChannel;
  code: "provider_disabled";
}>;

export interface NotificationChannelAdapter {
  readonly channel: ExternalNotificationChannel;
  dispatch(input: DisabledAdapterRequest): Promise<DisabledAdapterResult>;
}
