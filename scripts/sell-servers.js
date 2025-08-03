/** @param {NS} ns */
export async function main(ns) {
  var x = 0
  //var prefix = "praxis-server-1024TB"
  var prefix = "praxis-server-8TB"
  //var prefix = "praxis-server-1PB"
  
  for(var i = 1; i <= 25; i++) {
    
    if(i < 10) {
      x = "-0"+i
    } else {
      x = "-"+i
    }
    
    if(ns.killall(prefix + x))
    {
      ns.tprintf("SUCCEEDED killing processes on: " + prefix + x)
    } else {
      ns.tprintf("FAILED to kill processes on: " + prefix + x)
    }

    if(ns.deleteServer(prefix + x)){
      ns.tprintf("SUCCEEDED deleting server: " + prefix + x)
    } else {
      ns.tprintf("FAILED to delete server: " + prefix + x)
    }

        
  }

  return true;

}