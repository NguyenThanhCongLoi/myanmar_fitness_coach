"""Hourly HTTP-only scheduler. This container never opens the SQLite volume."""
import os
import time
import urllib.request

token = os.environ['NOTIFICATION_CRON_TOKEN']
while True:
    try:
        request = urllib.request.Request(
            'http://web:3000/api/internal/notifications', data=b'{}', method='POST',
            headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'},
        )
        with urllib.request.urlopen(request, timeout=540) as response:
            print('Notification tick HTTP', response.status, flush=True)
    except Exception as error:
        # Never log request headers or the cron token.
        print('Notification tick failed:', type(error).__name__, flush=True)
    time.sleep(3600)
