const { DateTime } = require("luxon");
const markdownItAnchor = require("markdown-it-anchor");
const markdownItFootnote = require("markdown-it-footnote");
const markdownItMark = require("markdown-it-mark");
const markdownItLinkAttributes = require("markdown-it-link-attributes");
const markdownItAbbr = require("markdown-it-abbr");
const pluginRss = require("@11ty/eleventy-plugin-rss");
const pluginSyntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");
const pluginBundle = require("@11ty/eleventy-plugin-bundle");
const pluginNavigation = require("@11ty/eleventy-navigation");
const { EleventyHtmlBasePlugin } = require("@11ty/eleventy");
const eleventyImage = require("@11ty/eleventy-img");
const path = require("path");

function pluginImages(eleventyConfig) {
  function relativeToInputPath(inputPath, relativeFilePath) {
    let split = inputPath.split("/");
    split.pop();

    return path.resolve(split.join(path.sep), relativeFilePath);
  }

  eleventyConfig.addAsyncShortcode(
    "image",
    async function imageShortcode(src, alt, widths, sizes) {
      let formats = ["avif", "webp", "auto"];
      let file = relativeToInputPath(this.page.inputPath, src);
      let metadata = await eleventyImage(file, {
        widths: widths || ["auto"],
        formats,
        outputDir: path.join(eleventyConfig.dir.output, "img"),
      });

      let imageAttributes = {
        alt,
        sizes,
        loading: "lazy",
        decoding: "async",
      };
      return eleventyImage.generateHTML(metadata, imageAttributes);
    },
  );
}

module.exports = function (eleventyConfig) {
  eleventyConfig.addWatchTarget("**/*.css");
  eleventyConfig.addPlugin(pluginImages);
  eleventyConfig.addPlugin(pluginRss);
  eleventyConfig.addPlugin(pluginSyntaxHighlight);
  eleventyConfig.addPlugin(pluginNavigation);
  eleventyConfig.addPlugin(EleventyHtmlBasePlugin);
  eleventyConfig.addPlugin(pluginBundle);

  eleventyConfig.addFilter("readableDate", (dateObj, format, zone) => {
    // Formatting tokens for Luxon: https://moment.github.io/luxon/#/formatting?id=table-of-tokens
    return DateTime.fromJSDate(dateObj, { zone: zone || "utc" }).toFormat(
      format || "dd LLLL yyyy",
    );
  });

  eleventyConfig.addFilter("htmlDateString", dateObj => {
    // dateObj input: https://html.spec.whatwg.org/multipage/common-microsyntaxes.html#valid-date-string
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("yyyy-LL-dd");
  });

  eleventyConfig.amendLibrary("md", lib => {
    lib
      .use(markdownItAnchor, {
        permalink: markdownItAnchor.permalink.headerLink({
          safariReaderFix: true,
        }),
        slugify: eleventyConfig.getFilter("slugify"),
      })
      .use(markdownItLinkAttributes, [
        {
          matcher(href) {
            return href.match(/^https?:\/\//);
          },
          attrs: {
            target: "_blank",
            rel: "noopener noreferrer",
          },
        },
      ])
      .use(markdownItFootnote)
      .use(markdownItMark)
      .use(markdownItAbbr);
  });

  return {
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    dataTemplateEngine: "njk",
  };
};
