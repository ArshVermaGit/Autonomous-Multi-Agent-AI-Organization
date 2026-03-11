import asyncio
from textual.app import App, ComposeResult
from textual.widgets import Header, Footer, Input, RichLog
from textual.binding import Binding


class ProximusNovaTUI(App):
    """A Textual app to manage the Proximus-Nova Orchestrator."""

    CSS = """
    Screen {
        background: #09090b;
        color: #f1f5f9;
    }
    
    #log {
        height: 1fr;
        border: solid #27272a;
        background: #18181b;
        padding: 1;
        scrollbar-background: #18181b;
        scrollbar-color: #3f3f46;
    }
    
    #cmd_input {
        dock: bottom;
        margin: 1 0;
        border: solid #10b981;
        background: #09090b;
        color: #f1f5f9;
    }
    
    Header {
        background: #050505;
        color: #34d399;
    }
    
    Footer {
        background: #09090b;
        color: #a1a1aa;
    }
    """

    BINDINGS = [
        Binding("ctrl+c", "quit", "Quit", show=True),
        Binding("ctrl+l", "clear_log", "Clear Log", show=True),
    ]

    TITLE = "Proximus-Nova Orchestrator"
    SUB_TITLE = "[Amazon Nova Models Active | MoE Local Setup]"

    def compose(self) -> ComposeResult:
        """Create child widgets for the app."""
        yield Header(show_clock=True)
        yield RichLog(id="log", highlight=True, wrap=True, markup=True)
        yield Input(
            placeholder="➜ Type a goal (e.g. 'Build a Next.js landing page...')",
            id="cmd_input",
        )
        yield Footer()

    def on_mount(self) -> None:
        """Called when app starts."""
        log = self.query_one(RichLog)

        # Initial boot sequence logs
        log.write("[bold cyan]Loading Proximus-Nova kernel...[/]")
        log.write("[bold cyan]Initializing AI sub-systems: [/][bold green][OK][/]")
        log.write(
            "[bold cyan]Mounting Model Context Protocol (MCP): [/][bold green][OK][/]"
        )
        log.write(
            "[bold cyan]Connecting to Amazon Bedrock Nova Foundation: [/][bold green][READY][/]"
        )
        log.write("\n[dim]Awaiting command... Type 'exit' to quit.[/]")

        self.query_one(Input).focus()

    def action_clear_log(self) -> None:
        """Action for clearing the log."""
        self.query_one(RichLog).clear()

    async def simulate_execution(self, command: str) -> None:
        """Simulate execution logic streaming into the log."""
        log = self.query_one(RichLog)
        await asyncio.sleep(0.5)
        log.write(f"[dim]\\[Orchestrator] Parsing intent for: '{command}'[/]")
        await asyncio.sleep(1.0)
        log.write("[bold magenta]\\[Engineer Agent][/] ➜ Generating execution plan...")
        await asyncio.sleep(1.5)
        log.write(
            "[bold yellow]\\[System][/] ➜ Executing terminal command mapping context."
        )
        await asyncio.sleep(2.0)
        log.write(
            "[bold green]\\[Success][/] Task simulated successfully. (Run full system to see actual agent workflows)."
        )

    async def on_input_submitted(self, event: Input.Submitted) -> None:
        """Handle when the user hits enter in the input field."""
        command = event.value.strip()
        if not command:
            return

        input_widget = self.query_one(Input)
        log = self.query_one(RichLog)

        input_widget.value = ""

        if command.lower() in ("exit", "quit"):
            self.exit()
            return

        log.write(f"\n[bold white]➜ {command}[/]")
        self.run_worker(self.simulate_execution(command), exclusive=True)


if __name__ == "__main__":
    app = ProximusNovaTUI()
    app.title = "Proximus-Nova Orchestrator"
    app.run()
