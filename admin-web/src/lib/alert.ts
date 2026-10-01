export function playNewOrderChime() {
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.value = 0.08;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
      context.close();
    }, 180);
  } catch {
    // ignore if audio is blocked
  }
}

export function notifyNewOrder(tableNumber: string) {
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification('New order', { body: `Table ${tableNumber}` });
  }
}

export async function ensureNotificationPermission() {
  if (typeof Notification === 'undefined') {
    return;
  }
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}
