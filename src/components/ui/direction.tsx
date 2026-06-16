import {
  DirectionProvider as BaseDirectionProvider,
  type DirectionProviderProps,
} from "@base-ui/react/direction-provider";

export function DirectionProvider({
  direction,
  children,
}: DirectionProviderProps) {
  return (
    <BaseDirectionProvider direction={direction}>
      {children}
    </BaseDirectionProvider>
  );
}
