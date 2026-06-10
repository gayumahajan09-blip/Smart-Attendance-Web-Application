// FINAL wificheck.js — FULL BLOCKING immediately if wifiDisconnected
(function(){

  /* --- IMMEDIATE BLOCK CHECK BEFORE PAGE LOAD --- */
  if (localStorage.getItem("wifiConnected") !== "true") {
    document.write(`
      <div style="
        position:fixed; top:0; left:0; right:0; bottom:0;
        background:rgba(245,245,245,0.98); z-index:999999;
        display:flex; align-items:center; justify-content:center;
        font-family:Arial; text-align:center; padding:20px;">
        
        <div style="
          background:white; padding:25px; border-radius:10px;
          max-width:600px; box-shadow:0 6px 18px rgba(0,0,0,0.1);">
          
          <h1 style="color:#d32f2f; margin-top:0;">
            Server Problem
          </h1>

          <p style="font-size:16px; color:#444;">
            Server problem or your device is not connected to clg's wifi so firstly connect it
          </p>

          <!-- Retry: show loading but do NOT navigate away -->
          <button onclick="(function(b){ b.innerText='Loading...'; b.disabled=true; })(this)"
            style="margin-top:15px; padding:10px 18px; font-size:15px;
            border:1px solid #ccc; background:#eee; cursor:pointer; border-radius:6px;">
            Retry
          </button>

        </div>
      </div>
    `);
    return; // STOP page completely
  }

  /* --- HEARTBEAT FOR LIVE CHECKS --- */
  const HEARTBEAT = 3000;
  let timer = null;

  function blockPage() {
    document.body.innerHTML = "";
    document.write(`
      <div style="
        position:fixed; top:0; left:0; right:0; bottom:0;
        background:rgba(245,245,245,0.98); z-index:999999;
        display:flex; align-items:center; justify-content:center;
        font-family:Arial; text-align:center; padding:20px;">
        
        <div style="
          background:white; padding:25px; border-radius:10px;
          max-width:600px; box-shadow:0 6px 18px rgba(0,0,0,0.1);">
          
          <h1 style="color:#d32f2f; margin-top:0;">
            Server Problem
          </h1>

          <p style="font-size:16px; color:#444;">
            Server problem or your device is not connected to clg's wifi so firstly connect it
          </p>

          <!-- Retry: show loading but do NOT navigate away -->
          <button onclick="(function(b){ b.innerText='Loading...'; b.disabled=true; })(this)"
            style="margin-top:15px; padding:10px 18px; font-size:15px;
            border:1px solid #ccc; background:#eee; cursor:pointer; border-radius:6px;">
            Retry
          </button>

        </div>
      </div>
    `);
  }

  function startHeartbeat() {
    timer = setInterval(() => {
      if (localStorage.getItem("wifiConnected") !== "true") {
        blockPage();
      }
    }, HEARTBEAT);
  }

  // Start monitoring
  startHeartbeat();

})();
