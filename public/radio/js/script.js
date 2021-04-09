const socket = io(window.location.origin);
const seekElement = document.getElementById("seek_1");
const timestamp = document.querySelector(".controls .timestamp p");

function formatTime(sec) {
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec / 3600 - hours) * 60);
  const seconds = Math.floor((((sec / 3600 - hours) * 60) - minutes) * 60);

  return {
    hours,
    minutes,
    seconds
  }
}

socket.emit("radioListen", "TestRadio");

socket.on("trackInfo", info => {
  const { duration, position } = info;
  let time = info.position / 1000 - 7;
  if (time < 0) time = 0;

  const formattedTime = formatTime(time);
  const formattedDur = formatTime(duration - 7);

  seekElement.max = duration;

  timestamp.textContent = formattedTime.minutes.toString().padStart(2, "0") + ":" + formattedTime.seconds.toString().padStart(2, "0");
  timestamp.textContent += " / " + formattedDur.minutes.toString().padStart(2, "0") + ":" + formattedDur.seconds.toString().padStart(2, "0");
  seekElement.value = time;
});