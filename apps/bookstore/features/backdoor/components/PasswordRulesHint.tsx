import { checkPasswordRules, PASSWORD_RULE_HINT } from "@/features/backdoor/passwordRules";

interface PasswordRulesHintProps {
  password: string;
}

/** 强度规则常驻提示：按满足项逐条点亮。 */
export default function PasswordRulesHint({ password }: PasswordRulesHintProps) {
  const rules = checkPasswordRules(password);
  const items = [
    { key: "length", label: "至少 16 位", met: rules.length },
    { key: "letter", label: "包含字母", met: rules.letter },
    { key: "digit", label: "包含数字", met: rules.digit },
    { key: "symbol", label: "包含符号", met: rules.symbol },
  ] as const;

  return (
    <div className="flex flex-col gap-1 text-xs">
      <span className="text-ink-dim">{PASSWORD_RULE_HINT}</span>
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {items.map((item) => (
          <li
            key={item.key}
            className={item.met ? "text-flower" : "text-ink-dim"}
          >
            {item.met ? "✓ " : "· "}
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
