import { Diagram } from "@/components/diagram";
import { CopyBlock } from "@/components/copy-block";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { mcpConfig, startCommand } from "@/lib/snippets";

const channels = ["WhatsApp", "Discord", "Telegram", "Slack", "Email"];

const yourTools = ["Zero", "Twenty", "Cognee", "Luma", "Devpost", "Companies House", "Meetup", "Email"];

const builtIn = ["Built-in list", "Built-in memory", "London data", "Test outbox"];

export default function HomePage() {
  return (
    <>
      <div className="sky">
        <div className="discovery">
          <div className="wrap">Open source · MIT · Test mode is the default</div>
        </div>
        <SiteHeader tone="sky" />
        <section className="hero">
          <div className="wrap rise">
            <p className="eyebrow">London communities and venues</p>
            <h1 className="hero-title">Your community&rsquo;s front desk and sponsor desk, inside the agent you already use</h1>
            <p className="hero-support">
              A chat request is qualified, priced from past bookings, and matched to real London sponsors. The drafted ask waits for one tap.
            </p>
            <div className="hero-actions">
              <a className="btn-paper" href="/docs">
                Read the docs
              </a>
              <a className="btn-text btn-text-sky" href="#flow">
                See the flow
              </a>
            </div>
            <Diagram
              src="/diagrams/01-anatomy-of-a-sponsor-engine.png"
              alt="Anatomy of a sponsor engine. An organiser asks Grok Bot. The Sponsor MCP forecasts turnout, finds sponsors, drafts an ask, and waits for one approval before the test inbox."
              width={1600}
              height={1540}
              priority
            />
          </div>
        </section>
      </div>

      <main id="content">
        <section className="section" id="compare">
          <div className="wrap">
            <p className="eyebrow">The same 80-person hack</p>
            <h2>Without AI, generic AI, and Sponsor Engine</h2>
            <p className="lede">
              Finding a food sponsor is a long job when every tab is yours. The counts below are organiser steps. The tools inside the dashed box are not counted.
            </p>
            <div className="compare">
              <article className="card-support">
                <p className="eyebrow">By hand</p>
                <p className="count">10</p>
                <h3 className="card-title">Without AI</h3>
                <p className="card-copy">
                  You browse past London events, hunt for a contact, write each email, and track the replies in your head.
                </p>
                <p className="meta">6 apps. Luma, search, a sheet, and mail.</p>
              </article>
              <article className="card-support">
                <p className="eyebrow">A chat tab</p>
                <p className="count">9</p>
                <h3 className="card-title">Generic AI</h3>
                <p className="card-copy">
                  You ask a chat for sponsors. You still check each name, then copy and paste between the chat, a sheet, and mail.
                </p>
                <p className="meta">4 apps. 4 copy-pastes.</p>
              </article>
              <article className="card-narrative">
                <p className="eyebrow">One ask, one tap</p>
                <p className="count">2</p>
                <h3 className="card-title">Grok Bot + Sponsor Engine</h3>
                <p className="card-copy">
                  You ask once. You tap Approve. The server forecasts turnout, finds sponsors with sources, and drafts the ask.
                </p>
                <p className="meta">1 app. Nothing to paste.</p>
              </article>
            </div>
            <Diagram
              src="/diagrams/02-without-ai-vs-generic-ai-vs-grok-bot.png"
              alt="Three columns compare the organiser steps for one food sponsor: 10 steps without AI, 9 steps with a generic assistant, and 2 steps with Grok Bot plus the MCP."
              width={1600}
              height={1760}
              caption="Step counts come from the numbered actions in each column. Times are not measured."
            />
          </div>
        </section>

        <section className="section" id="flow">
          <div className="wrap">
            <p className="eyebrow">Ask to approved send</p>
            <h2>Four steps from the chat to the outbox</h2>
            <p className="lede">
              The same path runs from Grok Bot, ChatGPT, Claude, Cursor, or Codex. Sponsor Engine is the MCP server. You do not open a new portal.
            </p>
            <div className="card-support">
              <ol className="flow">
                <li>
                  <span className="step-index">01</span>
                  <div>
                    <h3>Qualify</h3>
                    <p className="tool-name">triage_inbound</p>
                    <p>
                      A request arrives from {channels.join(", ")}. The desk records the community or the company, the date, the headcount, and the need. It opens a task with an owner and a priority.
                    </p>
                  </div>
                </li>
                <li>
                  <span className="step-index">02</span>
                  <div>
                    <h3>Price</h3>
                    <p className="tool-name">quote_booking · forecast_turnout</p>
                    <p>
                      The room price comes from past bookings. A community rate and a company rate are both explained. Turnout uses this community&rsquo;s history when three events exist. Otherwise it uses a 28% no-show. The held-out error is calculated. It is not typed in.
                    </p>
                  </div>
                </li>
                <li>
                  <span className="step-index">03</span>
                  <div>
                    <h3>Match</h3>
                    <p className="tool-name">find_sponsors · draft_sponsor_ask</p>
                    <p>
                      London sponsors are ranked with a reason and a source link. The ask is the food cost, about £5.50 for each person the forecast expects. The room price stays separate.
                    </p>
                  </div>
                </li>
                <li>
                  <span className="step-index">04</span>
                  <div>
                    <h3>Approve</h3>
                    <p className="tool-name">send_with_approval · approve</p>
                    <p>
                      The email waits in the outbox. You tap Approve, Edit, or Skip. Test mode writes a log. It does not send.
                    </p>
                  </div>
                </li>
              </ol>
            </div>
            <Diagram
              src="/diagrams/03-it-learns-from-your-events.png"
              alt="Learning loop. Replies and Luma check-ins update a show-up profile. The community graph feeds the next turnout forecast."
              width={1600}
              height={1640}
              caption="After the event, replies and check-ins update the show-up rate. That profile feeds the next forecast."
            />
          </div>
        </section>

        <section className="section" id="tools">
          <div className="wrap">
            <p className="eyebrow">Optional keys</p>
            <h2>Bring your own tools</h2>
            <p className="lede">
              Keep the CRM, the memory, and the event tools you already use. Leave the keys empty and the built-in list does the work. The built-in tools need no keys.
            </p>
            <div className="card-support">
              <div className="chip-block">
                <p className="eyebrow">Your tools</p>
                <div className="chip-grid">
                  {yourTools.map((name) => (
                    <span className="chip" key={name}>
                      {name}
                    </span>
                  ))}
                </div>
              </div>
              <div className="chip-block">
                <p className="eyebrow">Built-in defaults</p>
                <div className="chip-grid">
                  {builtIn.map((name) => (
                    <span className="chip" key={name}>
                      {name}
                    </span>
                  ))}
                </div>
              </div>
              <p className="soon">HubSpot and Sheets are not available yet.</p>
            </div>
          </div>
        </section>

        <section className="section" id="safety">
          <div className="wrap">
            <p className="eyebrow">Every send, order, or payment</p>
            <h2>Safe by default</h2>
            <div className="safe-grid">
              <div>
                <p className="badge badge-open" style={{ marginBottom: 16 }}>
                  <i />
                  Test mode
                </p>
                <p className="lede">
                  Nothing real goes out during the build. Every action is logged. A message can reach a test inbox only after a person taps Approve, and only when you leave test mode.
                </p>
                <ul className="rules">
                  <li>DRY_RUN is true in every environment until you set it to false.</li>
                  <li>Approve writes a log. In test mode the row stays approved.</li>
                  <li>A row is marked sent only when it is approved, DRY_RUN is false, and the address is on the allow list.</li>
                  <li>This build has no email sender, no WhatsApp sender, and no payment method.</li>
                </ul>
              </div>
              <Diagram
                src="/diagrams/04-safe-by-default.png"
                alt="Safety path. Grok Bot calls an action tool. Test mode logs the send. An address off the allow list is blocked. A person approves, edits, or skips before anything reaches the test inbox."
                width={1600}
                height={1580}
                caption="The only real send in the diagram is the test inbox, after the human gate."
              />
            </div>
          </div>
        </section>

        <section className="section" id="run">
          <div className="wrap">
            <p className="eyebrow">Node.js 22</p>
            <h2>Run it tonight</h2>
            <p className="lede">
              One command starts the desk. The first start loads the bundled data. Open the inbox and press Run demo. Then point the agent you already pay for at this MCP server.
            </p>
            <div className="run-grid">
              <CopyBlock label="Start" code={startCommand} />
              <CopyBlock label="MCP config" tone="ink" code={mcpConfig} />
            </div>
            <p className="lede" style={{ marginTop: 24, marginBottom: 0 }}>
              Set the working directory to the project folder. Keep <code>DRY_RUN</code> true. The dashboard opens at http://localhost:3000. Configs for Grok Bot, Cursor, Claude, ChatGPT, and Codex are on the{" "}
              <a href="/docs/connect">Connect</a> page.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
