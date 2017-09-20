function NotificationBuilder(data) {
    switch (data) {
        case "system":
            return new Notification(data);
            break;
        case "ffnet":
            return new FFnetNotification(data);
            break;
    }
}

class Notification {

}

class FFnetNotification {
    constructor(data, context) {

    }
}

module.exports = {NotificationBuilder};