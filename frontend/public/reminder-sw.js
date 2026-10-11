/* Push-only worker. Never intercept requests or cache retained iteration pages. */
self.addEventListener('push',event=>{
  event.waitUntil(self.registration.showNotification('SipAware daily check-in',{
    body:'If you have not checked in today, record a drink or confirm No alcohol.',
    tag:'sipaware-daily-check-in',renotify:false,
    data:{url:'/iteration3#todays-check-in'},
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  // Use the canonical no-trailing-slash entry: the hosted /iteration3/ returns 404.
  // Do not trust a URL from a push payload, and do not navigate an in-progress form.
  event.waitUntil(self.clients.openWindow('/iteration3#todays-check-in'));
});
