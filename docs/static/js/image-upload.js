document.querySelectorAll(".image-file-input").forEach((input) => {
  input.addEventListener("change", () => {
    const file = input.files[0];
    const targetId = input.dataset.target;
    const previewId = input.dataset.preview;
    const target = document.getElementById(targetId);
    const preview = document.getElementById(previewId);

    if (!file || !target) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("Please choose an image file.");
      input.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert("Please choose an image smaller than 2MB.");
      input.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      target.value = reader.result;

      if (preview) {
        preview.innerHTML = "";
        const img = document.createElement("img");
        img.src = reader.result;
        img.alt = "Selected image preview";
        preview.appendChild(img);
      }
    };

    reader.readAsDataURL(file);
  });
});
