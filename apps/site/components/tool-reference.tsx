import { CopyBlock } from "@/components/copy-block";
import toolsFile from "@/generated/tools.json";

type Field = {
  name: string;
  type: string;
  required: boolean;
  description: string;
};

type Tool = {
  name: string;
  title: string;
  description: string;
  input: Field[];
  exampleCall: Record<string, unknown>;
  exampleResult: unknown;
};

export function ToolReference() {
  const tools = toolsFile.tools as Tool[];

  return (
    <div>
      <p className="tool-meta">
        Server {toolsFile.server}, version {toolsFile.version}. This page reads {toolsFile.source}. Run{" "}
        <code>npm run extract-tools</code> in <code>apps/site</code> after a tool change. The build runs that script.
      </p>
      {tools.map((tool) => (
        <section className="tool" id={tool.name} key={tool.name}>
          <p className="eyebrow">{tool.title}</p>
          <h2>{tool.name}</h2>
          <p>{tool.description}</p>
          <h3>Input</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Type</th>
                  <th>Required</th>
                  <th>Purpose</th>
                </tr>
              </thead>
              <tbody>
                {tool.input.map((field) => (
                  <tr key={field.name}>
                    <td>
                      <code>{field.name}</code>
                    </td>
                    <td>
                      <code>{field.type}</code>
                    </td>
                    <td>{field.required ? "Yes" : "No"}</td>
                    <td>{field.description || "The server stores this value."}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3>Example call</h3>
          <CopyBlock
            label={tool.name}
            code={JSON.stringify({ name: tool.name, arguments: tool.exampleCall }, null, 2)}
          />
          <h3>Example result</h3>
          <CopyBlock label="Result" code={JSON.stringify(tool.exampleResult, null, 2)} />
        </section>
      ))}
    </div>
  );
}
