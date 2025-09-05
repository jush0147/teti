# Bot-Stacking-Helper for teti

## Introduction  

This project provides a real-time stacking assistant for the `teti` Tetris platform. By integrating the powerful `MisaMinoTBP` bot, it helps players practice and understand stacking strategies in Zen/Custom modes.  

## Notes  

- **Experimental**: This is a proof-of-concept project, mainly to showcase the idea. It is unlikely to be actively maintained or bug-fixed.  
- **AI-assisted development**: Most of the code was generated with the help of AI tools:  
  - Jules (Gemini 2.5 Pro)  
  - Cursor (Claude Opus 4.1)  

## Known Issues  

- Works only with **SRS (Super Rotation System)**.  
- Potential coordinate conversion issues, especially with the **I piece**.  
- T-Spins suggested by the bot may not be recognized by `teti`’s scoring system.  

## Demo  

- [Demo Video](https://youtu.be/CjdberDtXBo?si=1OU6k85BlkSsIhnv)  
- [Try it Live](https://jush0147.github.io/Bot-Stacking-Helper-for-teti/)  

## How it Works  

1. The board state is captured and converted into TBP format.  
2. The data is sent to the `MisaMinoTBP` bot, which calculates the optimal placement.  
3. The bot’s TBP coordinates are converted back into `teti` coordinates.  
4. The current piece is automatically moved and placed at the suggested position.  

## Acknowledgements  

This project builds on the great work of:  

- [teti](https://github.com/TitanPlayz100/teti)  
- [MisaMinoTBP](https://github.com/jezevec10/MisaMinoTBP)  
- [tbp-spec](https://github.com/tetris-bot-protocol/tbp-spec)  
- [Tetris Wiki (SRS)](https://tetris.fandom.com/wiki/Super_Rotation_System)  

## License  

This project is licensed under the MIT License. See the `LICENSE` file for details.