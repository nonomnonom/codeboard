export type Point = number[];
export interface Foot {
    x: number;
    y: number;
    planted: boolean;
}
export interface Pose {
    w: number;
    h: number;
    bottom: number;
    lean: number;
    eye: number;
    gaze: number;
    feet: Foot[];
}
export interface Exposure {
    frame: number;
    id: string;
    x: number;
    y: number;
}
export interface DrawOptions {
    parent?: string;
    x?: number;
    y?: number;
    scale?: number;
    rough?: boolean;
    detail?: boolean;
    opacity?: number;
    name?: string;
    exposure?: {
        startFrame: number;
        endFrame: number;
    };
}
