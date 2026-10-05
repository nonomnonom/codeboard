import type { Command } from "commander";
import { resolve } from "node:path";

export function registerStoryboardCommands(program: Command): void {
  program
    .command("render")
    .argument("<project>", "Path to a .cboard file")
    .option("-o, --output <directory>", "Export directory", "storyboard-export")
    .option("--columns <number>", "Panels per sheet row", "2")
    .option("--rows <number>", "Panel rows per sheet page", "2")
    .action(
      async (projectPath: string, options: { output: string; columns: string; rows: string }) => {
        const [{ StoryboardProject }, { exportStoryboard }] = await Promise.all([
          import("../../core/project.js"),
          import("../../export/storyboard-export.js"),
        ]);

        const project = await StoryboardProject.open(resolve(projectPath));
        const result = await exportStoryboard(project, resolve(options.output), {
          columns: Number(options.columns),
          rows: Number(options.rows),
        });
        console.log(`Rendered ${result.panelFiles.length} panels and ${result.pdfFile}`);
      },
    );

  program
    .command("animatic")
    .argument("<project>", "Path to a .cboard file")
    .option("-o, --output <directory>", "Animatic package directory", "animatic-export")
    .option("--max-frames <number>", "Maximum frame count", "100000")
    .action(async (projectPath: string, options: { output: string; maxFrames: string }) => {
      const [{ StoryboardProject }, { exportAnimaticPackage }] = await Promise.all([
        import("../../core/project.js"),
        import("../../export/animatic-export.js"),
      ]);

      const project = await StoryboardProject.open(resolve(projectPath));
      const result = await exportAnimaticPackage(project, resolve(options.output), {
        maxFrames: Number(options.maxFrames),
      });
      console.log(`Rendered ${result.frameFiles.length} frames and ${result.manifestFile}`);
    });
}
