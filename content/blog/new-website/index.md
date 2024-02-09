+++
title = "Rewriting my website and starting a blog"
date  = "2024-02-09"
+++

I already have a website hosted on GitHub pages. It was built around 2 years
ago as a way to quickly browse and access my web projects. Basically it was
just a grid of project thumbnails which is pretty boring. During the last 2
years I changed bits and pieces of it, but it's still the same boring layout
with no information other than the list of projects, not even an about page.

<!-- more -->

<!-- TODO: Add a picture of the old website -->

So I decided to nuke the old website and build a new one entirely from scratch.
I wanted to keep the old website's project showcasing ability so I added
[a page](/works) just for that. This time, instead of calling the GitHub API to
get the projects, I just put everything inside a TOML file which gives me more
controls and I can even display non-web related projects. The only downside is
that I have to manually add new projects to the TOML file and rebuild the
website, but I plan on updating my website frequently anyways so hopefully that
wont be a problem.

# What's new here

Other than for showcasing my projects I also started a blog on this website!
Well it's kind of obvious as you're reading one of the articles. After browsing
the web and looking at amazing pages full of unique contents for a while, I
wanted to have my own content. I wanted this website to reflect what I thought
and what I learned over time, mostly for me too look back but I also wanted to
share it with other people.

Hopefully people will encounter this website the same way I came across others.
Maybe you're looking for something and a search engine lookup leads you to one
of my posts. But before speculating maybe I should start to actually write some
blog posts.

# How is this website made

The previous iteration of this website is created with vanilla HTML/CSS/JS, and
the GitHub API. This architecture works but it's really annoying to add more
pages, let alone managing an entire blog. I didn't have any trouble writing CSS
or JavaScript but HTML is a real problem to me:

1. HTML is too static, which can leads to lots of repetition. I want to
   dynamically generate markups based on some external data.
2. HTML is too verbose, that's great for structuring a web page but for writing
   it's absolutely horrible. I want to generate HTML from another markup
   language that's better for writing.

To solve those problems I need a templating engine to dynamically generate HTML
and a Markdown compiler to convert Markdown files - which is much better for
writing - to HTML files. A tool that uses those technologies and generates HTML
is called a static site generator (SSG). It's very tempting to write my own SSG
but I wanted to focus more on blogging so for the time being I'm just going to
use something pre-built. It's not going to be exactly what I want but It's also
going to save me from building and maintaining an SSG along with my website.

## Choosing an SSG

There are lots of SSGs out there, but I wanted to use the single-binary ones,
which means that the entire SSG is a single, self-contained executable. There
are some benefits of this approach, the most obvious being that installing,
removing, and upgrading the SSG is much easier. You don't need to install a
language runtime, like Ruby for Jekyll or Node.js for Astro or Eleventy. You
also doesn't need to manage dependencies, as the maintainers of the SSG have
already done that and packaged everything into a neat little executable for
you. The downside is that it will be much less flexible than using something on
top of a language runtime but if I want flexibility I'll just roll my own SSG.

This left me with two options that I know of: Hugo and Zola. Hugo is much more
mature, has a bigger community, more well documented API, tones of themes and
example websites to ~~steal code~~ get inspiration from. However, I decided to
use Zola, because it uses the Tera templating engine also from the same
creator. Tera is based on the syntax popularized by Jinja2/Django that I'm very
familiar with. It has template inheritance, which significantly remove lots of
boilerplate code, and the macro system is so powerful that it's basically a
declarative programming language. I'm not saying the Hugo templating engine is
bad, I just prefer something similar to what I already knew. Tera being similar
to django templating language also means that it partially works on my editor
by default. Zola and Tera are created more recently, and there are some rough
edges but they are not too significant.

## My experience with Zola

After working on this website for a while, I think that Zola is a really great
piece of software. It does everything I need it to do, it let me do whatever I
want, I feel like I have a lot of controls without too much effort, even over
the generated code. The build time is crazy fast, on my laptop this site takes
**25ms** to build. All of this makes working with Zola very pleasant, and I
think a more mature SSG like Hugo might be even better. I wholeheartedly
recommendusing SSG for small to medium websites like blog, documentation,
wikis, cooking recipes,... You can get really far with it before needing a more
heavy-duty web framework.

Another neat thing with SSGs is that because the site is static, hosting them
is extremely cheap and easy. There are free hosting options out there like
GitHub Pages, Vercel, Netlify,... so all you need to spend money on is the
domain name, which I don't have, so I literally spent nothing on this website.
I used to host this new website on Vercel, because it supports Zola by default,
but there are some problems so I switched back to GitHub Pages. I don't trust
the GitHub action build script, so I just build the website on my laptop and
push the generated website to a separate `gh-pages` branch using `git subtree`.
Despite this I still recommend using Vercel because it's really simple and if
you use the correct Zola version nothing will go wrong.

# What to expect from this website

With all the technical details of this website out of the way, here is what I'm
going to do with the website. First, it will still be a project showcasing
websites, so this website will be updated with my newest projects. I might even
write about new projects if I feel like they deserve a dedicated blog post.
With this new website I want to increase presentability of my projects before
putting them here. I'll also try to improve older projects but I won't
prioritize doing them as much as making new ones. So expect the
[projects page](/works) of this website to be filled with more higher-quality
softwares.

Secondly, as mentioned earlier I'll start a blog about what I thought and
learned, or just what I wanted to share. It'll mostly be about technologies,
especially the ones that I'm working with or interested in. Currently I don't
have a clear vision of what I want to write about, so in the forseeable future
I'll just write random things and see what works and what doesn't. It's 2024
and blogging isn't as popular as it was before but I still want to start and
maintain one because at least I can benefit from doing it.
