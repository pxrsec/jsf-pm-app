import "server-only";

import type {
  ExternalDeliveryCapability,
  ExternalDeliveryConfigurationCode,
  ProviderConfigurationCode,
  ProviderConfigurationState,
} from "./types";

const PLACEHOLDER_FRAGMENTS = [
  "replace_me",
  "replace-me",
  "replace me",
  "example",
  "placeholder",
  "changeme",
  "change-me",
  "your_",
  "your-",
  "<",
  ">",
] as const;

function isPlaceholder(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "") {
    return false;
  }
  return PLACEHOLDER_FRAGMENTS.some((fragment) => trimmed.includes(fragment));
}

function isValidResendApiKey(value: string | undefined): boolean {
  if (value === undefined || isPlaceholder(value)) {
    return false;
  }
  const trimmed = value.trim();
  return /^re_\S+$/.test(trimmed);
}

function isValidResendFromEmail(value: string | undefined): boolean {
  if (value === undefined || isPlaceholder(value)) {
    return false;
  }
  const trimmed = value.trim();
  if (/\s/.test(trimmed)) {
    return false;
  }
  const parts = trimmed.split("@");
  if (parts.length !== 2) {
    return false;
  }
  const [local, domain] = parts;
  if (!local || !domain) {
    return false;
  }
  if (domain.startsWith(".") || domain.endsWith(".") || !domain.includes(".")) {
    return false;
  }
  return true;
}

function isValidNumericId(value: string | undefined): boolean {
  if (value === undefined || isPlaceholder(value)) {
    return false;
  }
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed);
}

function isValidWhatsAppApiVersion(value: string | undefined): boolean {
  if (value === undefined || isPlaceholder(value)) {
    return false;
  }
  const trimmed = value.trim();
  return /^v\d+\.\d+$/.test(trimmed);
}

function parseEmailProviderState(): ProviderConfigurationState {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  const isKeyPresent = apiKey !== undefined && apiKey.trim() !== "";
  const isEmailPresent = fromEmail !== undefined && fromEmail.trim() !== "";

  const isKeyPlaceholder = isPlaceholder(apiKey);
  const isEmailPlaceholder = isPlaceholder(fromEmail);

  if (isKeyPlaceholder || isEmailPlaceholder) {
    return { kind: "disabled", code: "provider_placeholder" };
  }

  if (apiKey === undefined && fromEmail === undefined) {
    return { kind: "disabled", code: "provider_missing" };
  }

  if (!isKeyPresent && !isEmailPresent) {
    return { kind: "disabled", code: "provider_blank" };
  }

  if (!isKeyPresent || !isEmailPresent) {
    return { kind: "disabled", code: "provider_partial" };
  }

  if (!isValidResendApiKey(apiKey) || !isValidResendFromEmail(fromEmail)) {
    return { kind: "disabled", code: "provider_malformed" };
  }

  return { kind: "ready" };
}

function parseWhatsAppProviderState(): ProviderConfigurationState {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const businessId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const secret = process.env.WHATSAPP_APP_SECRET;
  const version = process.env.WHATSAPP_API_VERSION;

  const rawFields = [token, phoneId, businessId, secret, version];

  const anyPlaceholder = rawFields.some((f) => isPlaceholder(f));
  if (anyPlaceholder) {
    return { kind: "disabled", code: "provider_placeholder" };
  }

  const allMissing = rawFields.every((f) => f === undefined);
  if (allMissing) {
    return { kind: "disabled", code: "provider_missing" };
  }

  const allBlankOrMissing = rawFields.every(
    (f) => f === undefined || f.trim() === "",
  );
  if (allBlankOrMissing) {
    return { kind: "disabled", code: "provider_blank" };
  }

  const anyMissingOrBlank = rawFields.some(
    (f) => f === undefined || f.trim() === "",
  );
  if (anyMissingOrBlank) {
    return { kind: "disabled", code: "provider_partial" };
  }

  const isValidToken = token !== undefined && token.trim() !== "";
  const isValidPhone = isValidNumericId(phoneId);
  const isValidBusiness = isValidNumericId(businessId);
  const isValidSecret = secret !== undefined && secret.trim() !== "";
  const isValidVersion = isValidWhatsAppApiVersion(version);

  if (
    !isValidToken ||
    !isValidPhone ||
    !isValidBusiness ||
    !isValidSecret ||
    !isValidVersion
  ) {
    return { kind: "disabled", code: "provider_malformed" };
  }

  return { kind: "ready" };
}

function getAggregateProviderCode(
  emailState: ProviderConfigurationState,
  whatsappState: ProviderConfigurationState,
): ExternalDeliveryConfigurationCode {
  const codes: ProviderConfigurationCode[] = [];
  if (emailState.kind === "disabled") {
    codes.push(emailState.code);
  }
  if (whatsappState.kind === "disabled") {
    codes.push(whatsappState.code);
  }

  if (codes.includes("provider_placeholder")) {
    return "provider_configuration_placeholder";
  }
  if (
    codes.includes("provider_missing") ||
    codes.includes("provider_blank") ||
    codes.includes("provider_partial")
  ) {
    return "provider_configuration_incomplete";
  }
  if (codes.includes("provider_malformed")) {
    return "provider_configuration_malformed";
  }
  return "provider_configuration_incomplete";
}

export function getExternalDeliveryCapability(): ExternalDeliveryCapability {
  const rawMode = process.env.EXTERNAL_DELIVERY_MODE;

  if (rawMode === undefined) {
    return {
      kind: "disabled",
      mode: "disabled",
      code: "mode_missing",
      email: { kind: "disabled", code: "provider_disabled" },
      whatsapp: { kind: "disabled", code: "provider_disabled" },
    };
  }

  const trimmedMode = rawMode.trim();
  if (trimmedMode === "") {
    return {
      kind: "disabled",
      mode: "disabled",
      code: "mode_blank",
      email: { kind: "disabled", code: "provider_disabled" },
      whatsapp: { kind: "disabled", code: "provider_disabled" },
    };
  }

  if (isPlaceholder(rawMode)) {
    return {
      kind: "disabled",
      mode: "disabled",
      code: "mode_placeholder",
      email: { kind: "disabled", code: "provider_disabled" },
      whatsapp: { kind: "disabled", code: "provider_disabled" },
    };
  }

  const lowerMode = trimmedMode.toLowerCase();

  if (lowerMode === "disabled") {
    return {
      kind: "disabled",
      mode: "disabled",
      code: "mode_disabled",
      email: { kind: "disabled", code: "provider_disabled" },
      whatsapp: { kind: "disabled", code: "provider_disabled" },
    };
  }

  if (lowerMode === "active") {
    const emailState = parseEmailProviderState();
    const whatsappState = parseWhatsAppProviderState();

    if (emailState.kind === "ready" && whatsappState.kind === "ready") {
      return {
        kind: "active-ready",
        mode: "active",
        email: { kind: "ready" },
        whatsapp: { kind: "ready" },
      };
    }

    const aggregateCode = getAggregateProviderCode(emailState, whatsappState);
    return {
      kind: "invalid",
      mode: "disabled",
      code: aggregateCode,
      email: emailState,
      whatsapp: whatsappState,
    };
  }

  const emailState = parseEmailProviderState();
  const whatsappState = parseWhatsAppProviderState();
  return {
    kind: "invalid",
    mode: "disabled",
    code: "mode_invalid",
    email: emailState,
    whatsapp: whatsappState,
  };
}

export function isNotificationDemoAlertEvaluationEnabled(): boolean {
  const rawFlag = process.env.NOTIFICATION_DEMO_ALERT_EVALUATION_ENABLED;
  if (rawFlag === undefined) {
    return false;
  }
  return rawFlag.trim().toLowerCase() === "true";
}
