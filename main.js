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

            btn.addEventListener('click', async (ev)=>{
                storeUndo(btn);
                // Remove highlight from all boxes before highlighting the clicked one
                document.querySelectorAll('.box').forEach(b => b.classList.remove('clicked'));
                animateBox(btn, ev);
                btn.classList.add('clicked'); // Ensure highlight stays after animation
                const teamIdx = getSelectedTeam();
                const pts = getPointsFromBox(btn);
                if (pts > 0) {
                    await addPointsToTeam(teamIdx, pts);
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

    function storeUndo(box) {
        // Keep max 3 in stack
        if (undoStack.length >= 3) undoStack.shift();
        undoStack.push({
            box: box,
            label: box.querySelector('.label').textContent,
            wasClicked: box.classList.contains('clicked'),
            lastClickedText: lastClicked.textContent
        });
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

    // Undo logic
    undoBtn.addEventListener('click', ()=>{
        if(undoStack.length > 0) {
            const undo = undoStack.pop();
            const box = undo.box;
            // Remove click effect if it was added
            box.classList.remove('clicked');
            box.style.background = '';
            // Restore label if changed (optional: comment out if you do not wish to undo renames)
            // box.querySelector('.label').textContent = undo.label;
            // Restore lastClicked message
            lastClicked.textContent = undo.lastClickedText || 'Last clicked: —';
        }
    });

    // Reset disables undo
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
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
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
});




