function toggleMenu() {
    const menu = document.querySelector(".menu-links");
    const icon = document.querySelector(".hamburger-icon");
    menu.classList.toggle("open");
    icon.classList.toggle("open");
  }

function toggleProject(element) {
    const content = element.querySelector('.project-content');

    if (element.classList.contains("expanded")) {
        content.style.maxHeight = "0";
        content.style.paddingTop = "0";
        element.classList.remove("expanded");
    } else {
        content.style.maxHeight = content.scrollHeight + "px"; // Expand to fit content
        content.style.paddingTop = "10px";
        element.classList.add("expanded");
    }
}
