import { describe, expect, it } from "vitest";

import { isValidCnpj, isValidCpf } from "@/lib/document";
import { normalizePlateCode } from "@/lib/plate-code";
import { checkDestinationUrl } from "@/lib/url";
import { clientCreateSchema, routingUpdateSchema, toFieldErrors } from "@/lib/validation";

describe("checkDestinationUrl", () => {
  it.each(["https://exemplo.com", "http://exemplo.com/a?b=1#c", "https://wa.me/5511999999999"])("aceita %s", (url) => {
    expect(checkDestinationUrl(url).ok).toBe(true);
  });

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox",
    "file:///etc/passwd",
    "ftp://exemplo.com",
    "//exemplo.com",
    "exemplo.com",
    "https://user:senha@exemplo.com",
    "https://exemplo.com/\u0000",
    "https://exem plo.com",
    "",
    `https://exemplo.com/${"a".repeat(2100)}`,
  ])("rejeita %s", (url) => {
    expect(checkDestinationUrl(url).ok).toBe(false);
  });

  it("normaliza a URL", () => {
    expect(checkDestinationUrl("  HTTPS://Exemplo.COM  ")).toEqual({ ok: true, url: "https://exemplo.com/" });
  });
});

describe("código da placa", () => {
  it("aceita números e textos simples, normalizando para minúsculas", () => {
    expect(normalizePlateCode("1")).toBe("1");
    expect(normalizePlateCode(" 1042 ")).toBe("1042");
    expect(normalizePlateCode("Loja-Centro_2")).toBe("loja-centro_2");
  });

  it("rejeita formatos que poderiam quebrar a URL ou escapar do caminho", () => {
    for (const bad of ["", "../etc", "a/b", "-1", "com espaço", "a?b", "<script>", "x".repeat(33)]) {
      expect(normalizePlateCode(bad)).toBeNull();
    }
  });
});

describe("CPF/CNPJ", () => {
  it("valida dígitos verificadores", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11.222.333/0001-80")).toBe(false);
  });
});

describe("schemas", () => {
  it("normaliza campos opcionais vazios para null e documento para dígitos", () => {
    const parsed = clientCreateSchema.parse({ name: "  Loja  ", tradeName: "", document: "529.982.247-25", email: "A@B.COM" });
    expect(parsed).toMatchObject({ name: "Loja", tradeName: null, document: "52998224725", email: "a@b.com", phone: null });
  });

  it("aponta o campo inválido nos botões da página", () => {
    const result = routingUpdateSchema.safeParse({
      version: 1,
      active: true,
      target: { kind: "url", url: "javascript:alert(1)" },
      page: { title: "T", description: "", buttons: [{ label: "Ok", url: "https://ok.com", active: true }, { label: "X", url: "data:x", active: true }] },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = toFieldErrors(result.error);
      expect(fields["target.url"]).toBeDefined();
      expect(fields["page.buttons.1.url"]).toBeDefined();
      expect(fields["page.buttons.0.url"]).toBeUndefined();
    }
  });
});
