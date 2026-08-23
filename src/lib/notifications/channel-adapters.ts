import "server-only";

import type {
  DisabledAdapterRequest,
  DisabledAdapterResult,
  ExternalNotificationChannel,
  NotificationChannelAdapter,
} from "./types";

class DisabledEmailAdapter implements NotificationChannelAdapter {
  readonly channel: ExternalNotificationChannel = "email";

  async dispatch(
    _input: DisabledAdapterRequest,
  ): Promise<DisabledAdapterResult> {
    void _input;
    return {
      kind: "not_dispatched",
      channel: "email",
      code: "provider_disabled",
    };
  }
}

class DisabledWhatsAppAdapter implements NotificationChannelAdapter {
  readonly channel: ExternalNotificationChannel = "whatsapp";

  async dispatch(
    _input: DisabledAdapterRequest,
  ): Promise<DisabledAdapterResult> {
    void _input;
    return {
      kind: "not_dispatched",
      channel: "whatsapp",
      code: "provider_disabled",
    };
  }
}

const disabledEmailAdapter = new DisabledEmailAdapter();
const disabledWhatsAppAdapter = new DisabledWhatsAppAdapter();

export function getNotificationChannelAdapter(
  channel: ExternalNotificationChannel,
): NotificationChannelAdapter {
  switch (channel) {
    case "email":
      return disabledEmailAdapter;
    case "whatsapp":
      return disabledWhatsAppAdapter;
  }
}
