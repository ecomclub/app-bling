'use strict'

let count = 0
let task = () => {
  count++
  console.log(count)
  if (count === 30) {
    process.exit(1)
  }
}
setTimeout(task, 1000)
