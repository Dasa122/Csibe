document.addEventListener('DOMContentLoaded', function() {
    const rows = 7, cols = 5;
    const grid = document.getElementById('grid');
    const lastClicked = document.getElementById('lastClicked');
    const resetBtn = document.getElementById('resetBtn');
    const shuffleBtn = document.getElementById('shuffleBtn');
    const undoBtn = document.getElementById('undoBtn');
    const teamSelector = document.getElementById('teamSelector');

    const undoStack = [];

    // Create the grid
    for(let r=1; r<=rows; r++){
        for(let c=1; c<=cols; c++){
            const btn = document.createElement('button');
            btn.className = 'box';
            btn.type = 'button';
            btn.setAttribute('role','gridcell');
            btn.dataset.row = r; btn.dataset.col = c;
            // Set label based on row
            let labelText = `${r},${c}`;
            if (r >= 1 && r <= 7) labelText = `${r}00`;
            btn.innerHTML = `<span class="label">${labelText}</span>`;

            // Add disable button (top-right corner)
            const disableBtn = document.createElement('span');
            disableBtn.textContent = '✖';
            disableBtn.title = 'Disable this box';
            disableBtn.className = 'remove-btn';
            disableBtn.style.position = 'absolute';
            disableBtn.style.top = '0.2vw';
            disableBtn.style.right = '0.5vw';
            disableBtn.style.fontSize = '1.2vw';
            disableBtn.style.cursor = 'pointer';
            disableBtn.style.opacity = '0.5';
            disableBtn.style.zIndex = '2';
            disableBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                btn.disabled = true;
                btn.classList.add('disabled');
            });
            btn.appendChild(disableBtn);

            // Add link button (top-left corner)
            const linkBtn = document.createElement('span');
            linkBtn.textContent = '🔗';
            linkBtn.title = 'Link to another HTML file';
            linkBtn.className = 'link-btn';
            linkBtn.style.position = 'absolute';
            linkBtn.style.top = '0.2vw';
            linkBtn.style.left = '0.5vw';
            linkBtn.style.fontSize = '1.2vw';
            linkBtn.style.cursor = 'pointer';
            linkBtn.style.opacity = '0.5';
            linkBtn.style.zIndex = '2';
            linkBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const url = prompt('Enter the relative path to the HTML file (e.g. "other.html"):', btn.dataset.link || '');
                if (url) {
                    btn.dataset.link = url;
                    linkBtn.style.opacity = '1';
                } else {
                    delete btn.dataset.link;
                    linkBtn.style.opacity = '0.5';
                }
            });
            btn.appendChild(linkBtn);

            btn.addEventListener('click', async (ev)=>{
                if (btn.disabled) return;
                // Only highlight the clicked box, keep it highlighted until another is clicked or reset
                document.querySelectorAll('.box').forEach(b => b.classList.remove('clicked'));
                btn.classList.add('clicked');
                lastSelectedBox = btn;
                lastSelectedPoints = getPointsFromBox(btn);

                // If linked, open the link and do not remove the box
                if (btn.dataset.link) {
                    window.open(btn.dataset.link, '_blank');
                    return;``
                }

                // Store undo state: if box will be removed, save its parent, nextSibling, and all relevant info
                storeUndo({
                    type: 'remove',
                    box: btn,
                    parent: btn.parentNode,
                    nextSibling: btn.nextSibling,
                    label: btn.querySelector('.label').textContent,
                    wasDisabled: btn.disabled,
                    wasClicked: btn.classList.contains('clicked')
                });

                animateBox(btn, ev);

                // Count it in the backend
                const teamIdx = getSelectedTeam();
                const pts = getPointsFromBox(btn);
                if (pts > 0) {
                    await addPointsToTeam(teamIdx, pts);
                    // Remove the box from the grid after counting
                    btn.remove();
                }
            });

            // right-click to rename individual box
            btn.addEventListener('contextmenu', (ev)=>{
                ev.preventDefault();
                const label = btn.querySelector('.label');
                const newName = prompt('Enter new name for this box:', label.textContent);
                if(newName){
                    label.textContent = newName;
                }
            });

            btn.tabIndex = 0;
            grid.appendChild(btn);
        }
    }

    // Store up to 3 undo states
    function storeUndo(undoObj) {
        if (undoStack.length >= 3) undoStack.shift();
        undoStack.push(undoObj);
    }

    function animateBox(box, ev){
        lastClicked.textContent = `Last clicked: ${box.querySelector('.label').textContent}`;
        // box.classList.remove('clicked'); // Remove this line, handled in click event
        void box.offsetWidth;
        // box.classList.add('clicked'); // Remove this line, now handled in click event after animation
        const rect = box.getBoundingClientRect();
        const x = (ev && typeof ev.clientX === "number") ? (ev.clientX - rect.left) : (rect.width/2);
        const y = (ev && typeof ev.clientY === "number") ? (ev.clientY - rect.top) : (rect.height/2);
        const ripple = document.createElement('span');
        ripple.className = 'ripple';
        const size = Math.max(rect.width, rect.height) * 2;
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = (x - size/2) + 'px';
        ripple.style.top = (y - size/2) + 'px';
        box.appendChild(ripple);
        box.style.background = 'linear-gradient(180deg, rgba(2,132,199,0.14), rgba(2,132,199,0.06))';
        setTimeout(()=>{ box.style.background = ''; }, 420);
        setTimeout(()=>{ ripple.remove(); }, 800);
    }

    // Helper: get selected team index
    function getSelectedTeam() {
        return parseInt(teamSelector.value, 10);
    }

    // Helper: get points value from box label (assumes label is a number)
    function getPointsFromBox(box) {
        const label = box.querySelector('.label').textContent;
        const pts = parseInt(label, 10);
        return isNaN(pts) ? 0 : pts;
    }

    // Update: when a box is clicked, add points to selected team via backend
    async function addPointsToTeam(teamIndex, points) {
        // Call backend API (assumes backend running at /api/add_points)
        try {
            await fetch('/api/add_points', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ team_index: teamIndex, points: points })
            });
        } catch (e) {
            // Optionally show error
            console.error('Failed to update backend:', e);
        }
    }

    // Undo logic: restore up to 3 removed boxes
    undoBtn.addEventListener('click', ()=>{
        if(undoStack.length > 0) {
            const undo = undoStack.pop();
            if (undo.type === 'remove' && undo.box && undo.parent) {
                // Restore the box to its previous position in the grid
                if (undo.nextSibling && undo.nextSibling.parentNode === undo.parent) {
                    undo.parent.insertBefore(undo.box, undo.nextSibling);
                } else {
                    undo.parent.appendChild(undo.box);
                }
                // Restore state
                undo.box.classList.toggle('clicked', undo.wasClicked);
                undo.box.disabled = undo.wasDisabled;
                if (undo.wasDisabled) {
                    undo.box.classList.add('disabled');
                } else {
                    undo.box.classList.remove('disabled');
                }
                // Optionally restore label if needed
                // undo.box.querySelector('.label').textContent = undo.label;
            }
        }
    });

    // Reset disables undo and removes highlight from all boxes
    resetBtn && resetBtn.addEventListener('click', ()=>{
        document.querySelectorAll('.box').forEach(b=>{
            b.classList.remove('clicked');
            b.style.background = '';
            b.querySelector('.label').textContent = `${b.dataset.row}00`;
        });
        lastClicked.textContent = 'Last clicked: —';
        undoStack.length = 0;
    });

    // Keyboard support
    grid.addEventListener('keydown', (e)=>{
        if(e.key === 'Enter' || e.key === ' '){
            const target = document.activeElement;
            if(target && target.classList.contains('box')){
                e.preventDefault();
                storeUndo(target);
                const ev = { clientX: target.getBoundingClientRect().left + target.offsetWidth/2, clientY: target.getBoundingClientRect().top + target.offsetHeight/2 };
                animateBox(target, ev);
            }
        }
    });

    // Keyboard shortcuts for main actions
    document.addEventListener('keydown', function(e) {
        // Undo: Ctrl+Z
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            undoBtn && undoBtn.click();
        }
        // Reset: Ctrl+R
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
            e.preventDefault();
            resetBtn && resetBtn.click();
        }
    });

    // Rename top row (row=1) to 100 and bottom row (row=7) to 700
    document.querySelectorAll('.box').forEach(box => {
        if (box.dataset.row === "1") {
            box.querySelector('.label').textContent = "100";
        }
        if (box.dataset.row === "2") {
            box.querySelector('.label').textContent = "200";
        }
        if (box.dataset.row === "3") {
            box.querySelector('.label').textContent = "300";
        }
        if (box.dataset.row === "4") {
            box.querySelector('.label').textContent = "400";
        }
        if (box.dataset.row === "5") {
            box.querySelector('.label').textContent = "500";
        }
        if (box.dataset.row === "6") {
            box.querySelector('.label').textContent = "600";
        }
        if (box.dataset.row === "7") {
            box.querySelector('.label').textContent = "700";
        }
    });

    // Add global toggle controls for hide/show remove and link buttons
    const controlsDiv = document.querySelector('.controls');
    const toggleRemoveBtn = document.createElement('button');
    toggleRemoveBtn.textContent = 'Toggle Remove Buttons';
    toggleRemoveBtn.type = 'button';
    toggleRemoveBtn.style.fontSize = '1vw';
    toggleRemoveBtn.style.padding = '0.3vw 1vw';
    toggleRemoveBtn.style.borderRadius = '1vw';

    const toggleLinkBtn = document.createElement('button');
    toggleLinkBtn.textContent = 'Toggle Link Buttons';
    toggleLinkBtn.type = 'button';
    toggleLinkBtn.style.fontSize = '1vw';
    toggleLinkBtn.style.padding = '0.3vw 1vw';
    toggleLinkBtn.style.borderRadius = '1vw';

    controlsDiv.appendChild(toggleRemoveBtn);
    controlsDiv.appendChild(toggleLinkBtn);

    let showRemove = true;
    let showLink = true;

    toggleRemoveBtn.addEventListener('click', () => {
        showRemove = !showRemove;
        document.querySelectorAll('.box .remove-btn').forEach(btn => {
            btn.style.display = showRemove ? '' : 'none';
        });
    });

    toggleLinkBtn.addEventListener('click', () => {
        showLink = !showLink;
        document.querySelectorAll('.box .link-btn').forEach(btn => {
            btn.style.display = showLink ? '' : 'none';
        });
    });

    // Add Miss and Success buttons to controls
    const successBtn = document.createElement('button');
    successBtn.textContent = 'Success';
    successBtn.type = 'button';
    successBtn.style.fontSize = '1.2vw';
    successBtn.style.padding = '0.5vw 1.5vw';
    successBtn.style.borderRadius = '1vw';

    const missBtn = document.createElement('button');
    missBtn.textContent = 'Miss';
    missBtn.type = 'button';
    missBtn.style.fontSize = '1.2vw';
    missBtn.style.padding = '0.5vw 1.5vw';
    missBtn.style.borderRadius = '1vw';

    controlsDiv.appendChild(successBtn);
    controlsDiv.appendChild(missBtn);

    // Track the last selected box for scoring
    let lastSelectedBox = null;
    let lastSelectedPoints = 0;

    // Success button: add points to selected team and remove the box
    successBtn.addEventListener('click', async () => {
        if (!lastSelectedBox || lastSelectedBox.disabled) return;
        const teamIdx = getSelectedTeam();
        const pts = lastSelectedPoints;
        if (pts > 0) {
            await addPointsToTeam(teamIdx, pts);
            // Remove the box from the grid after counting
            lastSelectedBox.remove();
            lastSelectedBox = null;
            lastSelectedPoints = 0;
        }
    });

    // Miss button: just remove the box, do not add points
    missBtn.addEventListener('click', () => {
        if (!lastSelectedBox || lastSelectedBox.disabled) return;
        lastSelectedBox.remove();
        lastSelectedBox = null;
        lastSelectedPoints = 0;
    });
});




