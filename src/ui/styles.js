// ============================================================================
//  Стили панели (одна строка, инжектится в <style>).
// ============================================================================
export const CSS = `
  #tarkan-bot-ui{position:fixed;left:8px;bottom:8px;z-index:2147483647;
    font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;color:#dce8f0;
    width:250px;border:1px solid #243240;border-radius:11px;overflow:hidden;
    background:linear-gradient(180deg,rgba(16,22,30,.97),rgba(9,13,18,.98));
    box-shadow:0 10px 34px rgba(0,0,0,.6);user-select:none;backdrop-filter:blur(4px)}
  #tarkan-bot-ui *{box-sizing:border-box;font:inherit}
  #tarkan-bot-ui .hd{display:flex;align-items:center;gap:6px;cursor:move;padding:8px 10px;
    background:linear-gradient(180deg,#172533,#0d1620);border-bottom:1px solid #243240}
  #tarkan-bot-ui .ttl{flex:1;font-weight:700;letter-spacing:.4px;color:#5fe0c0}
  #tarkan-bot-ui .ic{cursor:pointer;color:#8aa1b0;padding:0 4px;font-size:12px}
  #tarkan-bot-ui .ic:hover{color:#fff}
  #tarkan-bot-ui .body{padding:8px 10px 10px}
  #tarkan-bot-ui.min .body{display:none}
  #tarkan-bot-ui .sec{margin:10px 0 3px;color:#577086;font-size:9px;
    text-transform:uppercase;letter-spacing:1.2px}
  #tarkan-bot-ui .sec:first-child{margin-top:0}
  #tarkan-bot-ui .row{display:flex;flex-wrap:wrap;gap:5px;margin:4px 0;align-items:center}
  #tarkan-bot-ui input{flex:1;min-width:0;background:#070b10;border:1px solid #243240;
    border-radius:5px;color:#dce8f0;padding:4px 6px;outline:none}
  #tarkan-bot-ui input:focus{border-color:#3f6f8f}
  #tarkan-bot-ui input.sm{flex:0 0 52px;text-align:center}
  #tarkan-bot-ui button{background:#16222e;border:1px solid #2c4254;border-radius:5px;
    color:#dce8f0;padding:4px 8px;cursor:pointer;white-space:nowrap;transition:.1s}
  #tarkan-bot-ui button:hover{background:#1f3242;border-color:#3a5a72}
  #tarkan-bot-ui button:active{transform:translateY(1px)}
  #tarkan-bot-ui .tag{flex:0 0 24px;color:#7fd9c0;font-weight:700;text-align:center}
  #tarkan-bot-ui .go{flex:0 0 40px;background:#123e2c;border-color:#1c6b48;
    color:#7df0b8;text-align:center;font-weight:700}
  #tarkan-bot-ui .go:hover{background:#1a5c40}
  #tarkan-bot-ui .lbl{flex:0 0 auto;color:#6f87a0;padding:0 1px}
  #tarkan-bot-ui .ocrval{flex:1;text-align:right;color:#9bd9c4;font-weight:700}
  #tarkan-bot-ui .big{width:100%;margin-top:9px;padding:9px;font-weight:700;letter-spacing:.6px;
    background:linear-gradient(180deg,#8a2222,#681616);border-color:#c44;color:#ffe6e0}
  #tarkan-bot-ui .big:hover{background:linear-gradient(180deg,#a82a2a,#7e1e1e)}
  #tarkan-bot-ui .run{width:100%;margin-top:6px;padding:8px;font-weight:700;letter-spacing:.4px;
    background:linear-gradient(180deg,#15633f,#0d4a2e);border-color:#1c8b5a;color:#cffce4}
  #tarkan-bot-ui .run:hover{background:linear-gradient(180deg,#1a7a4d,#115a39)}
  #tarkan-bot-ui .run.on{background:linear-gradient(180deg,#8a2222,#681616);border-color:#d55;color:#ffe6e0}
  #tarkan-bot-ui .count{margin-top:7px;text-align:center;color:#9bd9c4;font-weight:700;
    letter-spacing:.5px;min-height:14px}
  #tarkan-bot-ui .stats{margin-top:7px;display:flex;justify-content:center;align-items:center;
    gap:6px;color:#7088a0;font-size:10px}
  #tarkan-bot-ui .rst{cursor:pointer;color:#5a6f82;font-size:9px;border:1px solid #2a3a4a;
    border-radius:3px;padding:0 4px;line-height:14px}
  #tarkan-bot-ui .rst:hover{color:#ff9a9a;border-color:#a44}
  #tarkan-bot-ui .log{margin-top:9px;padding:6px 8px;border-radius:5px;background:#070b10;
    border:1px solid #1a2530;color:#7fb89f;min-height:15px;word-break:break-all;font-size:10px}`;
