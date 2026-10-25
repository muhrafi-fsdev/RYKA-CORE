import type { BridgeState, CameraState, ProfileMode } from "./types";

type TopHudProps = {
  statusText: string;
  camera: CameraState;
  accessOpen: boolean;
  profile: ProfileMode;
  bridgeState: BridgeState;
};

export function TopHud({ statusText, camera, accessOpen, profile, bridgeState }: TopHudProps) {
  return (
    <>
      <header className="ultron-hud ultron-title">
        <div>RYKA CORE</div>
        <small>OPERATOR: MUHAMMAD RAFI PRIYO // PERSONAL ACCESS & PARTNER COMMUNICATION 4.4</small>
      </header>

      <div className="ultron-hud ultron-status-top">
        <span className={`ultron-dot ${camera === "on" ? "online" : ""}`} />
        <span>{statusText}</span>
        <span className="ultron-divider">//</span>
        <span>{accessOpen ? "ACCESS" : profile.toUpperCase()}</span>
        <span className="ultron-divider">//</span>
        <span className={`ultron-bridge-state ${bridgeState}`}>
          BRIDGE {bridgeState.toUpperCase()}
        </span>
      </div>

      <div className="ultron-hud ultron-hints">
        <div>
          <span className="ultron-key">DRAG</span> SPIN&nbsp;&nbsp;
          <span className="ultron-key">SCROLL</span> ZOOM
        </div>
        <div>
          <span className="ultron-key">PINCH 1 HAND</span> ROTATE&nbsp;&nbsp;
          <span className="ultron-key">PINCH 2 HANDS</span> ZOOM
        </div>
        <div>
          <span className="ultron-key">CLOSED FIST</span> ARM&nbsp;&nbsp;
          <span className="ultron-key">OPEN PALM</span> LOCK
        </div>
        <div>
          <span className="ultron-key">SWIPE</span> DYNAMIC COMMANDS&nbsp;&nbsp;
          <span className="ultron-key">RELEASE</span> ANTI-REPEAT
        </div>
        <div>
          <span className="ultron-key">G</span> GESTURES&nbsp;&nbsp;
          <span className="ultron-key">P</span> PANEL&nbsp;&nbsp;
          <span className="ultron-key">A</span> ACCESS&nbsp;&nbsp;
          <span className="ultron-key">R</span> RESET&nbsp;&nbsp;
          <span className="ultron-key">1/2/3</span> VIEW&nbsp;&nbsp;
          <span className="ultron-key">CTRL+SHIFT+F12</span> EMERGENCY STOP
        </div>
      </div>
    </>
  );
}
