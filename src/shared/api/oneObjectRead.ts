/**
 * How a read of one object runs. `ownProcess`: in a `cm` process of its own, not a pooled `cm shell`, for a read
 * that may wait its whole timeout (an object on another server, which may not answer): a pooled session held that
 * long stalls every read behind it (ARCHITECTURE.md "Server budget").
 */
export interface OneObjectRead {
  ownProcess?: boolean;
}
