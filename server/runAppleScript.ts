// https://github.dev/guidepup/guidepup
import { execFile } from "child_process";

export const DEFAULT_TIMEOUT = 10000;
export const DEFAULT_MAX_BUFFER = 1000 * 1000 * 100;


export async function runAppleScript<T = string | void>(opts: {
  script: string,
  jxa?: boolean,
  timeout?: number,
}
): Promise<T> {
  // const scriptWithTimeout = `with timeout of ${opts.timeout} seconds\n${opts.script}\nend timeout`;

  return (await new Promise<string | void>((resolve, reject) => {
    const child = execFile(
      "/usr/bin/osascript",
      opts.jxa ? ['-l', 'JavaScript'] : [],
      {
        maxBuffer: DEFAULT_MAX_BUFFER,
      },
      (e, stdout, stderr) => {
        if (e) {
          return reject(e);
        }

        if (stderr) {
          console.error(stderr);
          return reject(new Error(stderr));
        }

        if (!stdout) {
          return resolve();
        } else {
          return resolve(stdout.trim());
        }
      }
    );

    child.stdin?.write(opts.script);
    child.stdin?.end();
  })) as unknown as T;
}

export async function runBrowserJavaScript<T = string | void>(opts: {
  script: string,
}
) {
  return await runAppleScript({
    script: `const chrome = Application('Google Chrome');
    chrome.windows[0].activeTab.execute({javascript: "alert('example');" });`
  })
}