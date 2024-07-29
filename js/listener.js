export let listener_status = true

export let exclude = new Set()

class Event {
    constructor(keys, type, module, callback, callback_end = null) {
        this.keys = keys
        this.type = type
        this.module = module
        this.callback = callback
        this.callback_end = callback_end
    }
}


function openListener(exclude_module) {
    exclude = new Set()
    for (const module of exclude_module) {
        exclude.add(module)
    }
    listener_status = false
}

function closeListener() {
    listener_status = true
}


function addEventListener(events) {

    for (const event_element of events) {
        if (event_element.module == null) {
            continue
        }
        event_element.module.addEventListener(event_element.type, () => {
            if (!listener_status && !exclude.has(event_element.module)) {
                return
            }
            event_element.callback()
        }, false);
    }

    document.addEventListener('keydown', (event) => {
        for (const event_element of events) {
            if (event_element.keys == null) {
                continue
            }
            if (event_element.keys.includes(event.key)) {
                if (!listener_status && !exclude.has(event_element.module)) {
                    return
                }
                event_element.callback()
            }
        }
    });
    document.addEventListener('keyup', (event) => {
        console.log(event.key)
        for (const event_element of events) {
            if (event_element.keys == null || event_element.callback_end == null) {
                continue
            }
            if (event_element.keys.includes(event.key)) {
                if (!listener_status && !exclude.has(event_element.module)) {
                    return
                }
                event_element.callback_end()
            }
        }
    });
}

export {Event, addEventListener, openListener, closeListener}