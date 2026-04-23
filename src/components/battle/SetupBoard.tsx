'use client';

import SetupBoardCore, { type SetupBoardCoreProps } from './SetupBoardCore';

/**
 * `SetupBoard` — thin wrapper over the presentational `SetupBoardCore`.
 *
 * The current implementation does not subscribe to any Zustand store itself;
 * all props flow from the caller (simulator layouts). The split exists so
 * that future store-bound fields can be injected here without touching
 * `SetupBoardCore` or any `<SetupBoard />` caller.
 */
export type SetupBoardProps = SetupBoardCoreProps;

export default function SetupBoard(props: SetupBoardProps) {
  return <SetupBoardCore {...props} />;
}
