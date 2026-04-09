import { createHash } from "crypto";
import type {
  SoulboundCredentialId,
  SoulboundEmitInput,
  SoulboundIssuer as SoulboundOrganization,
  SoulboundSchemaId,
} from "@adasouls/soulbound-core";
import type { SoulboundProvider } from "./providers/types.js";

export class SoulboundIssuer {
  constructor(
    private readonly organization: SoulboundOrganization,
    private readonly provider: SoulboundProvider
  ) {}

  /**
   * Issue a soulbound credential for the given wallet.
   * Starts in PENDING state until the holder claims it.
   *
   * @example
   *   const credId = await issuer.emit({
   *     schema: "soulbound:v1:access",
   *     subject: { walletAddress, resourceId: "my-game:main", accessLevel: "MEMBER" },
   *   });
   */
  async emit(input: SoulboundEmitInput): Promise<SoulboundCredentialId> {
    const nowSecs = Math.floor(Date.now() / 1000);
    const walletHash = this.provider.hashWalletAddress(input.subject.walletAddress);
    const usernameHash = input.subject.username
      ? hashUsername(input.subject.username)
      : undefined;

    const { id } = await this.provider.issue({
      schemaId: input.schema,
      schemaVersion: "1.0.0",
      issuer: this.organization,
      subject: {
        walletHash,
        ...(usernameHash !== undefined && { usernameHash }),
        ...(input.subject.memberId !== undefined && { memberId: input.subject.memberId }),
        metadata: buildMetadata(input),
      },
      issuedAt: nowSecs,
      ...(input.expiresAt !== undefined && {
        expiresAt: Math.floor(input.expiresAt.getTime() / 1000),
      }),
      status: "PENDING",
      disclosureFields: disclosureFieldsFor(input.schema),
    });

    return id;
  }

  /**
   * Issue a time-limited trial access credential that expires automatically.
   *
   * @param walletAddress - Holder's public wallet address
   * @param resourceId    - Resource identifier (e.g. "my-game:main")
   * @param durationDays  - Trial duration in days
   */
  async emitTrial(
    walletAddress: string,
    resourceId: string,
    durationDays: number
  ): Promise<SoulboundCredentialId> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    return this.emit({
      schema: "soulbound:v1:access",
      subject: { walletAddress, resourceId, accessLevel: "TRIAL" },
      expiresAt,
    });
  }

  /**
   * Revoke a credential issued by this organization.
   */
  async revoke(credentialId: SoulboundCredentialId): Promise<void> {
    await this.provider.revoke(credentialId, this.organization.orgId);
  }
}

function hashUsername(username: string): string {
  return createHash("sha256").update(username.toLowerCase()).digest("hex");
}

function buildMetadata(input: SoulboundEmitInput): Record<string, unknown> {
  const meta: Record<string, unknown> = {};
  const s = input.subject;
  if (s.resourceId !== undefined) meta["resourceId"] = s.resourceId;
  if (s.accessLevel !== undefined) meta["accessLevel"] = s.accessLevel;
  if (s.tier !== undefined) meta["tier"] = s.tier;
  if (s.memberSince !== undefined) meta["memberSince"] = s.memberSince;
  if (s.achievementName !== undefined) meta["achievementName"] = s.achievementName;
  if (s.grade !== undefined) meta["grade"] = s.grade;
  if (s.courseId !== undefined) meta["courseId"] = s.courseId;
  if (s.professionCode !== undefined) meta["professionCode"] = s.professionCode;
  if (s.licenseNumber !== undefined) meta["licenseNumber"] = s.licenseNumber;
  if (s.specialty !== undefined) meta["specialty"] = s.specialty;
  if (s.issuingAuthority !== undefined) meta["issuingAuthority"] = s.issuingAuthority;
  return meta;
}

function disclosureFieldsFor(schema: SoulboundSchemaId): string[] {
  switch (schema) {
    case "soulbound:v1:access":       return ["resourceId", "accessLevel", "usernameHash"];
    case "soulbound:v1:membership":   return ["orgId", "memberSince", "tier", "usernameHash"];
    case "soulbound:v1:certificate":  return ["orgId", "achievementName", "issuedAt"];
    case "soulbound:v1:professional": return ["professionCode", "licenseNumber", "issuingAuthority"];
  }
}
