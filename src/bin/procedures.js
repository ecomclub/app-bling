'use strict'

let count = 0
let task = () => {
  count++
  console.log(count)
  process.exit(1)
  setTimeout(task, 1000)
}
task()
