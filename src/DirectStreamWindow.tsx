import React from "react";
import AppStream from "./AppStream";

type DirectStreamWindowProps = {
  sessionId: string;
  backendUrl: string;
  signalingserver: string;
  signalingport: number;
  mediaserver: string;
  mediaport: number;
  accessToken: string;
  resolutionWidth: number;
  resolutionHeight: number;
  onStarted: () => void;
  onStreamFailed: () => void;
  onLoggedIn: (userId: string) => void;
  handleCustomEvent: (event: unknown) => void;
};

export default class DirectStreamWindow extends React.Component<DirectStreamWindowProps> {
  render() {
    return (
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          padding: 0,
          margin: 0,
        }}
      >
        <div id="streamonly-wrapper">
          <AppStream
            sessionId={this.props.sessionId}
            backendUrl={this.props.backendUrl}
            signalingserver={this.props.signalingserver}
            signalingport={this.props.signalingport}
            mediaserver={this.props.mediaserver}
            mediaport={this.props.mediaport}
            accessToken={this.props.accessToken}
            resolutionWidth={this.props.resolutionWidth}
            resolutionHeight={this.props.resolutionHeight}
            onStarted={this.props.onStarted}
            onFocus={() => undefined}
            onBlur={() => undefined}
            style={{
              width: "100%",
              height: "100%",
              padding: 0,
              margin: 0,
            }}
            onLoggedIn={this.props.onLoggedIn}
            handleCustomEvent={this.props.handleCustomEvent}
            onStreamFailed={this.props.onStreamFailed}
          />
        </div>
      </div>
    );
  }
}
