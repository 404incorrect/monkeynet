/* ── Canopy Count ──────────────────────────────────────────────────────
   One swing per browser session. Come back tomorrow and you count again.

   The tally lives in a Supabase row that nothing can touch directly: RLS
   is on with no policies, so the publishable key below can only reach it
   through bump_canopy() / canopy_count(). Worst a bored monkey can do is
   make the number go up, which is what it's for.

   Drop `<b id="canopyN"></b>` inside `#canopyCount` on any page, then
   include this script. Stays hidden if the network is asleep.           */
(function () {
  var URL_ = 'https://ucopubxejatgjgqmqnlu.supabase.co';
  var KEY  = 'sb_publishable_P1clPSQ1JhkD2_yLtCpXFQ_BYN0Hhc6';

  var box = document.getElementById('canopyCount');
  var num = document.getElementById('canopyN');
  if (!box || !num) return;

  // Already swung this session? Read the tally instead of bumping it.
  var fn = 'bump_canopy';
  try {
    if (sessionStorage.getItem('canopy-swung')) fn = 'canopy_count';
    else sessionStorage.setItem('canopy-swung', '1');
  } catch (e) {
    // Private mode with storage walled off: just read, never double-count.
    fn = 'canopy_count';
  }

  fetch(URL_ + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: {
      apikey: KEY,
      Authorization: 'Bearer ' + KEY,
      'Content-Type': 'application/json'
    },
    body: '{}'
  })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(function (n) {
      // Odometer never shrinks: pad to 6 cells, widen if the canopy fills up.
      var digits = String(Number(n)).padStart(6, '0');
      num.textContent = '';
      for (var i = 0; i < digits.length; i++) {
        var cell = document.createElement('i');
        cell.textContent = digits[i];
        num.appendChild(cell);
      }
      box.hidden = false;
    })
    .catch(function () { /* the canopy keeps its own counsel */ });
})();
