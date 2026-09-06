/**
 * The rating + comment block that goes under every blog post and case study.
 *
 * Shared by build-blog.js and build-content.js rather than pasted into both,
 * because the two generators publish different URL shapes and the block has to
 * agree with the API about what a page is called. Keeping one copy means a
 * change to the markup cannot land on posts and miss case studies.
 *
 * `target` must be the page's canonical path — /blog/<slug>/ for a post,
 * /case-studies/<slug>.html for a case study. The Worker normalises the common
 * variations, but sending the canonical path keeps one page to one row without
 * relying on that.
 *
 * The section is emitted `hidden`. assets/js/engagement.js reveals it once the
 * API has answered, so a reader without JavaScript, or with the API
 * unreachable, sees nothing rather than a form that silently discards what
 * they typed.
 */
function engagementSection(target, options) {
  const opts = options || {};
  const noun = opts.noun || 'article';

  return `
        <section class="engagement" data-engagement="${target}" hidden>
            <div class="rating-block">
                <h2>Was this ${noun} useful?</h2>
                <p class="engagement-sub">One tap. It helps me judge what to write next.</p>
                <fieldset class="rating-stars" data-rating-stars>
                    <legend>Rate this ${noun} from 1 to 5</legend>
                    <input type="radio" id="rating-5" name="rating" value="5" /><label for="rating-5" title="5 out of 5">★</label>
                    <input type="radio" id="rating-4" name="rating" value="4" /><label for="rating-4" title="4 out of 5">★</label>
                    <input type="radio" id="rating-3" name="rating" value="3" /><label for="rating-3" title="3 out of 5">★</label>
                    <input type="radio" id="rating-2" name="rating" value="2" /><label for="rating-2" title="2 out of 5">★</label>
                    <input type="radio" id="rating-1" name="rating" value="1" /><label for="rating-1" title="1 out of 5">★</label>
                </fieldset>
                <p class="rating-summary" data-rating-summary></p>
            </div>

            <div class="comment-block">
                <h2>Comments <span class="comment-count" data-comment-count></span></h2>
                <p class="engagement-sub">Questions and corrections welcome — I read all of them.</p>

                <ol class="comment-list" data-comment-list></ol>
                <p class="comment-empty" data-comment-empty>No comments yet. Yours would be the first.</p>

                <form class="comment-form" data-comment-form novalidate>
                    <div class="comment-form-row">
                        <div>
                            <label for="comment-name">Name</label>
                            <input type="text" id="comment-name" name="name" maxlength="80" required placeholder="What should I call you?" />
                        </div>
                        <div>
                            <label for="comment-email">Email <span class="comment-form-note">— optional, never published</span></label>
                            <input type="email" id="comment-email" name="email" maxlength="200" placeholder="Only if you want a reply" />
                        </div>
                    </div>
                    <div>
                        <label for="comment-body">Comment</label>
                        <textarea id="comment-body" name="body" maxlength="2000" required placeholder="What did this miss, or what would you want next?"></textarea>
                    </div>

                    <div class="comment-hp" aria-hidden="true">
                        <label for="comment-website">Leave this field empty</label>
                        <input type="text" id="comment-website" name="website" tabindex="-1" autocomplete="off" />
                    </div>

                    <div class="comment-form-actions">
                        <button type="submit" class="btn btn-primary">Post comment</button>
                        <p class="comment-form-note">Comments are read before they appear, so yours won't show straight away.</p>
                    </div>
                    <p class="form-status" data-form-status role="status" aria-live="polite"></p>
                </form>
            </div>
        </section>
`;
}

module.exports = { engagementSection };
