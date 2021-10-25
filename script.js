;(async () => {
    document.getElementById('yo').innerHTML = new Date(Date.now() - new Date('1-12-2005')).getFullYear() - 1970
    const response = await fetch('https://api.github.com/users/ziap/repos')
    const data = await response.json()

    for (const repo of data.filter(repo => repo.has_pages && repo.name != 'ziap.github.io')) {
        const proj = document.createElement('a')
        const container = document.createElement('div')
        const img = new Image()
        const title = document.createElement('span')
        const titleContainer = document.createElement('div')

        titleContainer.className = 'title-container'
        proj.className = 'project'
        proj.href = '/' + repo.name;
        container.className = 'image-container'
        img.className = 'thumbnail'
        title.className = 'title'
        img.src = proj.href + '/logo.pnt'
        img.alt = repo.name.split('-').join(' ')
        title.innerHTML = img.alt.toUpperCase()

        container.appendChild(img)
        titleContainer.appendChild(title)
        proj.appendChild(container)
        proj.appendChild(titleContainer)
        document.getElementById('projects').appendChild(proj)
    }

    document.getElementById('search-bar').addEventListener('keyup', e => {
        for (const project of document.getElementsByClassName('project')) {
            const title = project.getElementsByClassName('title')[0].innerHTML
            if (e.target.value == '' || title.includes(e.target.value.toUpperCase())) project.style.display = ''
            else project.style.display = 'none'
        }
    })
})()
