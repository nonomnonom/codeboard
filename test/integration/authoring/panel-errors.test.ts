import { expect, test } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CodeboardError, StoryboardProject, type EditCommand } from "../../../src/index.js";

const cases: {
  name: string;
  direct(project: StoryboardProject): void;
  command: EditCommand;
}[] = [
  {
    name: "zero duration",
    direct: (p) => p.production.setPanelDuration("p", 0),
    command: { op: "panel.duration", id: "p", durationFrames: 0, mode: "ripple" },
  },
  {
    name: "preserved duration change",
    direct: (p) => p.production.setPanelDuration("p", 48, "preserve"),
    command: { op: "panel.duration", id: "p", durationFrames: 48, mode: "preserve" },
  },
  {
    name: "missing panel",
    direct: (p) => p.production.setPanelStatus("missing", "review"),
    command: { op: "panel.status", id: "missing", status: "review" },
  },
  {
    name: "invalid status from JavaScript",
    direct: (p) => p.production.setPanelStatus("p", "bogus" as never),
    command: { op: "panel.status", id: "p", status: "bogus" as never },
  },
  {
    name: "oversized transition",
    direct: (p) => p.production.setTransition("p", { type: "dissolve", durationFrames: 24 }),
    command: {
      op: "panel.transition",
      id: "p",
      transition: { type: "dissolve", durationFrames: 24 },
    },
  },
  {
    name: "malformed transition",
    direct: (p) => p.production.setTransition("p", { type: "dissolve", durationFrames: -1 }),
    command: {
      op: "panel.transition",
      id: "p",
      transition: { type: "dissolve", durationFrames: -1 },
    },
  },
];

test.each(["direct", "plan"] as const)(
  "panel %s failures retain structured errors and saved state",
  async (route) => {
    const directory = await mkdtemp(join(tmpdir(), "panel-errors-"));
    try {
      const p = StoryboardProject.create({ title: "Panel validation" });
      p.addScene("S").addShot("S").addPanel({ id: "p", durationFrames: 24 });
      const file = join(directory, "source.cboard");
      await p.save(file);
      const before = p.toJSON(),
        bytes = await readFile(file);
      for (const item of cases) {
        let failure: unknown;
        try {
          if (route === "direct") item.direct(p);
          else p.plan(item.name, [item.command]);
        } catch (error) {
          failure = error;
        }
        expect(failure).toBeInstanceOf(CodeboardError);
        if (!(failure instanceof CodeboardError)) throw new Error(`${item.name}: missing error`);
        expect(failure.code).toBe("INVALID_ARGUMENT");
        expect(failure.retryable).toBe(false);
        expect(p.toJSON()).toEqual(before);
        expect(await readFile(file)).toEqual(bytes);
        expect((await StoryboardProject.open(file)).toJSON()).toEqual(before);
        if (item.name === "missing panel")
          expect(failure.details).toMatchObject({
            reason: "missing-owner",
            ownerType: "panel",
            ownerId: "missing",
          });
        if (item.name === "oversized transition") {
          expect(failure.details).toMatchObject({
            reason: "transition-duration",
            panelId: "p",
            durationFrames: 24,
            panelDurationFrames: 24,
          });
          if (route === "plan") {
            expect(failure.details).toMatchObject({
              commandIndex: 0,
              commandOperation: "panel.transition",
            });
            expect(failure.cause).toBeInstanceOf(CodeboardError);
          }
        }
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);

test("caught invalid panel inputs preserve a surrounding transaction and its following valid edit", () => {
  const p = StoryboardProject.create({ title: "Caught validation" });
  p.addScene("S").addShot("S").addPanel({ id: "p", durationFrames: 24 });
  p.transaction("Recover", () => {
    for (const item of cases) {
      const before = p.toJSON();
      expect(() => item.direct(p)).toThrow(CodeboardError);
      expect(p.toJSON()).toEqual(before);
    }
    p.production.setPanelStatus("p", "review");
  });
  expect(p.toJSON().panels[0]!.status).toBe("review");
});
