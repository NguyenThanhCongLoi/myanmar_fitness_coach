import {expect,test} from 'vitest';
import {createECDH,randomBytes} from 'node:crypto';
import * as webpush from 'web-push';
test('VAPID signs and encrypts a real Web Push request without external delivery',()=>{
 const receiver=createECDH('prime256v1');receiver.generateKeys();
 const vapid=webpush.generateVAPIDKeys();
 const request=webpush.generateRequestDetails({endpoint:'https://fcm.googleapis.com/fcm/send/test-only',keys:{p256dh:receiver.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}},'A little encouragement',{vapidDetails:{subject:'https://example.test',...vapid},TTL:3600});
 expect(request.headers['Content-Encoding']).toBe('aes128gcm');
 expect(request.headers.Authorization).toBeTruthy();
 expect(request.body).toBeTruthy();
 expect(request.body!.includes(Buffer.from('A little encouragement'))).toBe(false);
});
