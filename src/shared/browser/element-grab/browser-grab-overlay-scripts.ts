export const HIDE_BROWSER_GRAB_OVERLAY_SCRIPT = `(function(){
  var g = window.__orcaGrab;
  if (g && g.host) g.host.style.display = 'none';
  document.querySelectorAll('[data-orca-browser-annotation-overlay]').forEach(function(el) {
    el.setAttribute('data-orca-previous-display', el.style.display || '');
    el.style.display = 'none';
  });
})()`

export const RESTORE_BROWSER_GRAB_OVERLAY_SCRIPT = `(function(){
  var g = window.__orcaGrab;
  if (g && g.host) g.host.style.display = '';
  document.querySelectorAll('[data-orca-browser-annotation-overlay]').forEach(function(el) {
    el.style.display = el.getAttribute('data-orca-previous-display') || '';
    el.removeAttribute('data-orca-previous-display');
  });
})()`
