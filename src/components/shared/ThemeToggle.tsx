import { AnimatePresence, motion } from "motion/react";
import { RiComputerLine, RiMoonLine, RiSunLine } from "@remixicon/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { swap } from "~/lib/animations";
import { useTheme } from "~/hooks/useTheme";
import { isThemePreference, type ThemePreference } from "~/lib/theme";

const OPTIONS: { value: ThemePreference; label: string; Icon: typeof RiSunLine }[] = [
  { value: "system", label: "System", Icon: RiComputerLine },
  { value: "light", label: "Light", Icon: RiSunLine },
  { value: "dark", label: "Dark", Icon: RiMoonLine },
];

export function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  const { Icon } = OPTIONS.find((o) => o.value === preference) ?? OPTIONS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Change theme"
        className="grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-[color,background-color,scale] hover:bg-muted hover:text-foreground active:scale-[0.96]"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={preference} {...swap} className="grid place-items-center">
            <Icon className="size-5" />
          </motion.span>
        </AnimatePresence>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        <DropdownMenuRadioGroup
          value={preference}
          onValueChange={(value) => {
            if (isThemePreference(value)) setPreference(value);
          }}
        >
          {OPTIONS.map(({ value, label, Icon: OptionIcon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <span className="flex items-center gap-2">
                <OptionIcon className="size-4" />
                {label}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
