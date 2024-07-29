class Stack {
    constructor() {
        this.items = []
    }

    push(el) {
        this.items.push(el)
    }

    pop() {
        return this.items.pop()
    }

    peek() {
        return this.items[this.items.length - 1]
    }

    clear() {
        this.items = []
    }

    size() {
        return this.items.length
    }

    isEmpty() {
        return this.items.length === 0
    }
}


const frame_stack = new Stack()

function addFrameHistory(frame) {
    frame_stack.push(frame)
}

function popFrameHistory() {
    if (frame_stack.isEmpty()) {
        return null
    }
    return frame_stack.pop()
}

function clearFrameHistory() {
    frame_stack.clear()
}


export {Stack, frame_stack, addFrameHistory, popFrameHistory, clearFrameHistory}