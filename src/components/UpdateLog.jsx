export default function UpdateLog({ wrap67 }) {
    return (
        <div className="update-log">
            <h3 className="update-log-title">Update Log</h3>
            <div className="update-log-scroll">
                <div className="update-entry">
                    <span className="update-date">v11 - Mar 17</span>
                    <ul className="update-list">
                        <li>You can now save results locally in your browser and load them later</li>
                        <li>Hypnoswitch results page now has separate collapsible sections for subject and hypnotist responses</li>
                        <li>Hypnoswitch share codes are now the same length as single-role codes</li>
                        <li>Hypnoswitch PDF export now generates two separate files (one for each role)</li>
                        <li>Compare feature now asks which role to use when a hypnoswitch code is detected</li>
                        <li>Added jump to top button at the bottom of every page</li>
                    </ul>
                </div>
                <div className="update-entry">
                    <span className="update-date">v10 - Mar 17</span>
                    <ul className="update-list">
                        <li>Hypnotists now see hypnotist-specific questions and subjects see subject-specific questions</li>
                        <li>Hypnoswitches see subject questions with a dropdown on each question to answer the hypnotist version separately</li>
                        <li>If you don't answer the hypnotist dropdown, it inherits your subject answer</li>
                    </ul>
                </div>
                <div className="update-entry">
                    <span className="update-date">v9 - Mar 15</span>
                    <ul className="update-list">
                        <li>Something happens when you click or type {wrap67("67")}</li>
                    </ul>
                </div>
                <div className="update-entry">
                    <span className="update-date">v8 - Mar 15</span>
                    <ul className="update-list">
                        <li>Your role (SUBJ, TIST, or SWIT) now gets added to the end of your share code and PDF filename</li>
                        <li>PDF now has alternating row shading so it's easier to read</li>
                        <li>Added this update log you're reading right now</li>
                    </ul>
                </div>
                <div className="update-entry">
                    <span className="update-date">v7 - Mar 15</span>
                    <ul className="update-list">
                        <li>Made the topbar buttons evenly spaced so it looks cleaner</li>
                    </ul>
                </div>
                <div className="update-entry">
                    <span className="update-date">v6 - Mar 15</span>
                    <ul className="update-list">
                        <li>Added a compare feature! You can now import two share codes and see what you have in common</li>
                        <li>The comparison page has 4 dropdown sections: Both Love, Shared Interests, They're Curious About, and They Said No</li>
                        <li>Each dropdown has a little ? button that explains what it's showing</li>
                        <li>Fixed the PDF separator lines, they were pushing answers to the next page before</li>
                    </ul>
                </div>
                <div className="update-entry">
                    <span className="update-date">v4 - Mar 14</span>
                    <ul className="update-list">
                        <li>Added this role selector page so you can pick if you're a Hypnotist, Subject, or Hypnoswitch</li>
                        <li>Made the "Curious about" button look different with a dashed purple border so it stands out, and moved it to the end</li>
                        <li>Added subtle lines between questions in the PDF so it's easier to read</li>
                        <li>You can now import a share code and edit your answers instead of just viewing them</li>
                        <li>Added an edit answers button on the results page</li>
                        <li>The share code now gets embedded at the bottom of exported PDFs so you can always get it back</li>
                        <li>Your role now shows on the PDF too</li>
                        <li>Removed "Diapering" and "Watersports" from suggestions</li>
                    </ul>
                </div>
                <div className="update-entry">
                    <span className="update-date">v3</span>
                    <ul className="update-list">
                        <li>You can now name your PDF file (e.g. quiz-result-Alice.pdf)</li>
                        <li>Added a Socials button</li>
                    </ul>
                </div>
                <div className="update-entry">
                    <span className="update-date">v2</span>
                    <ul className="update-list">
                        <li>Made the exported share codes way shorter</li>
                        <li>Old share codes still work, don't worry</li>
                    </ul>
                </div>
                <div className="update-entry">
                    <span className="update-date">v1</span>
                    <ul className="update-list">
                        <li>Fixed the mobile layout</li>
                        <li>All questions are optional now, you can skip whatever you want</li>
                        <li>Removed print-as-PNG because it looked bad</li>
                        <li>Added code importing and exporting so you can share your results</li>
                        <li>Fixed the PDF export, it was taking way too much space before</li>
                        <li>Added a Ko-fi button if you wanna support me</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
