export interface PasswordCheck {
  length: boolean;
  letter: boolean;
  digit: boolean;
  symbol: boolean;
}

/** 前端实时提示用强度规则（最终以后端校验为准）。 */
export function checkPasswordRules(password: string): PasswordCheck {
  return {
    length: password.length >= 12,
    letter: /[a-zA-Z]/.test(password),
    digit: /[0-9]/.test(password),
    symbol: /[^a-zA-Z0-9]/.test(password),
  };
}

export const PASSWORD_RULE_HINT = "至少 12 位，需同时包含字母、数字和符号";
