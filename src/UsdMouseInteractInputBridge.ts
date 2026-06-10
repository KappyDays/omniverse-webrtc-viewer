type MovementKeys = {
    w: boolean;
    a: boolean;
    s: boolean;
    d: boolean;
    q: boolean;
    e: boolean;
};

type SendMessage = (message: string) => void;

const EVENT_TYPE = 'usdMouseInteract.input';
const TRACKED_KEYS = new Set(['w', 'a', 's', 'd', 'q', 'e']);

export default class UsdMouseInteractInputBridge {
    private readonly _streamElement: HTMLElement;
    private readonly _sendMessage: SendMessage;
    private _seq = 0;
    private _dx = 0;
    private _dy = 0;
    private _keys: MovementKeys = this._releasedKeys();
    private _rafId: number | null = null;
    private _wasPointerLocked = false;
    private _disposed = false;

    constructor(streamElement: HTMLElement, sendMessage: SendMessage) {
        this._streamElement = streamElement;
        this._sendMessage = sendMessage;

        this._streamElement.addEventListener('mousedown', this._onMouseDown);
        this._streamElement.addEventListener('contextmenu', this._onContextMenu);
        document.addEventListener('pointerlockchange', this._onPointerLockChange);
        document.addEventListener('mousemove', this._onMouseMove);
        document.addEventListener('keydown', this._onKeyDown);
        document.addEventListener('keyup', this._onKeyUp);
        document.addEventListener('visibilitychange', this._onVisibilityChange);
        window.addEventListener('blur', this._onWindowBlur);
    }

    dispose() {
        if (this._disposed) {
            return;
        }
        this._disposed = true;
        this._sendReleasePacket(false);
        this._stopFrameLoop();

        this._streamElement.removeEventListener('mousedown', this._onMouseDown);
        this._streamElement.removeEventListener('contextmenu', this._onContextMenu);
        document.removeEventListener('pointerlockchange', this._onPointerLockChange);
        document.removeEventListener('mousemove', this._onMouseMove);
        document.removeEventListener('keydown', this._onKeyDown);
        document.removeEventListener('keyup', this._onKeyUp);
        document.removeEventListener('visibilitychange', this._onVisibilityChange);
        window.removeEventListener('blur', this._onWindowBlur);
    }

    private _onMouseDown = (event: MouseEvent) => {
        if (event.button !== 2 || this._disposed) {
            return;
        }

        event.preventDefault();
        this._streamElement.focus({ preventScroll: true });
        try {
            this._streamElement.requestPointerLock();
        } catch (error) {
            console.warn('Pointer lock request failed', error);
        }
    };

    private _onContextMenu = (event: MouseEvent) => {
        event.preventDefault();
    };

    private _onPointerLockChange = () => {
        const isLocked = this._isPointerLocked();
        if (isLocked) {
            this._wasPointerLocked = true;
            this._startFrameLoop();
            return;
        }

        if (this._wasPointerLocked) {
            this._wasPointerLocked = false;
            this._sendReleasePacket(document.hasFocus());
        }
        this._stopFrameLoop();
    };

    private _onMouseMove = (event: MouseEvent) => {
        if (!this._isPointerLocked()) {
            return;
        }
        this._dx += event.movementX;
        this._dy += event.movementY;
    };

    private _onKeyDown = (event: KeyboardEvent) => {
        if (!this._isPointerLocked()) {
            return;
        }

        const key = event.key.toLowerCase();
        if (!TRACKED_KEYS.has(key)) {
            return;
        }

        event.preventDefault();
        this._setKey(key, true);
    };

    private _onKeyUp = (event: KeyboardEvent) => {
        if (!this._isPointerLocked()) {
            return;
        }

        const key = event.key.toLowerCase();
        if (!TRACKED_KEYS.has(key)) {
            return;
        }

        event.preventDefault();
        this._setKey(key, false);
    };

    private _onVisibilityChange = () => {
        if (document.hidden) {
            this._sendReleasePacket(false);
        }
    };

    private _onWindowBlur = () => {
        this._sendReleasePacket(false);
    };

    private _startFrameLoop() {
        if (this._rafId !== null) {
            return;
        }

        const tick = () => {
            this._rafId = null;
            if (!this._disposed && this._isPointerLocked()) {
                this._sendPacket(true, document.hasFocus());
                this._rafId = window.requestAnimationFrame(tick);
            }
        };

        this._rafId = window.requestAnimationFrame(tick);
    }

    private _stopFrameLoop() {
        if (this._rafId === null) {
            return;
        }
        window.cancelAnimationFrame(this._rafId);
        this._rafId = null;
    }

    private _sendPacket(pointerLocked: boolean, focused: boolean) {
        const payload = {
            seq: this._seq++,
            dx: this._dx,
            dy: this._dy,
            keys: { ...this._keys },
            focused,
            pointerLocked,
            timestamp: performance.now()
        };
        this._dx = 0;
        this._dy = 0;

        this._sendMessage(JSON.stringify({
            event_type: EVENT_TYPE,
            payload
        }));
    }

    private _sendReleasePacket(focused: boolean) {
        this._dx = 0;
        this._dy = 0;
        this._keys = this._releasedKeys();
        this._sendPacket(false, focused);
    }

    private _isPointerLocked() {
        return document.pointerLockElement === this._streamElement;
    }

    private _setKey(key: string, value: boolean) {
        if (key === 'w') this._keys.w = value;
        if (key === 'a') this._keys.a = value;
        if (key === 's') this._keys.s = value;
        if (key === 'd') this._keys.d = value;
        if (key === 'q') this._keys.q = value;
        if (key === 'e') this._keys.e = value;
    }

    private _releasedKeys(): MovementKeys {
        return {
            w: false,
            a: false,
            s: false,
            d: false,
            q: false,
            e: false
        };
    }
}
