document.addEventListener('DOMContentLoaded', function () {
    const headers = document.querySelectorAll('.collapsible-header');

    headers.forEach(header => {
        header.addEventListener('click', function () {
            // Toggle the 'active' class on the header (optional, for styling)
            this.classList.toggle('active');

            // Get the content panel
            const content = this.nextElementSibling;
            const icon = this.querySelector('.toggle-icon');

            if (content.style.maxHeight && content.style.maxHeight !== "0px") {
                // If content is open, close it
                content.style.maxHeight = "0px";
                if (icon) icon.textContent = '+';
                content.classList.remove('open'); // For CSS transition
            } else {
                // If content is closed, open it
                // Set maxHeight to its scrollHeight for a smooth transition
                content.style.maxHeight = content.scrollHeight + "px";
                if (icon) icon.textContent = '−'; // Or '-', &minus;
                content.classList.add('open'); // For CSS transition
            }
        });

        // Initialize icons for sections that are initially collapsed
        // (all of them in this setup because of `style="display: none;"` initially)
        const content = header.nextElementSibling;
        const icon = header.querySelector('.toggle-icon');
        if (content.style.display === "none" || (content.style.maxHeight && content.style.maxHeight === "0px")) {
            if (icon) icon.textContent = '+';
            // Ensure max-height is 0 if display:none was used initially
            // and we are now relying on max-height for transitions
            if (content.style.display === "none") {
                content.style.display = ""; // Remove inline display:none
                content.style.maxHeight = "0px";
            }
        } else {
            if (icon) icon.textContent = '−';
            content.style.maxHeight = content.scrollHeight + "px"; // Ensure it's open if not display:none
            content.classList.add('open');
        }
    });
});
